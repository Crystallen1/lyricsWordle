import * as vscode from 'vscode';
import { Song, getRandomSong, loadSongs, getSongFromArtist, songs } from './songDatabase';
import * as path from 'path';
import * as fs from 'fs';
import { Leaderboard, LeaderboardRecord } from './leaderboard';

// 在文件顶部添加全局变量
let gamePanel: vscode.WebviewPanel | undefined;
let leaderboardPanel: vscode.WebviewPanel | undefined;
let leaderboard: Leaderboard;

export function activate(context: vscode.ExtensionContext) {
    // 初始化排行榜
    leaderboard = new Leaderboard(context);
    
    // 加载歌曲数据
    loadSongs(context);
    
    // 添加一个变量来存储当前选中的歌手
    let currentArtist: string | undefined;
    
    let currentGame: {
        song: Song;
        maskedName: string;
        maskedArtist: string;
        maskedLyrics: string;
        guessedChars: Set<string>;
        guessCount: number;
        isArtistRevealed: boolean;
    } | undefined;

    let disposable = vscode.commands.registerCommand('lyrics-guess.startGame', async () => {
        const song = currentArtist ? 
            getRandomSong(currentArtist) : 
            getRandomSong();
        
        currentGame = {
            song,
            maskedName: maskText(song.name),
            maskedArtist: maskText(song.artist),
            maskedLyrics: maskText(song.lyric),
            guessedChars: new Set(),
            guessCount: 0,
            isArtistRevealed: false
        };

        const panel = vscode.window.createWebviewPanel(
            'lyricsGuess',
            '猜歌词游戏',
            vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );

        panel.webview.onDidReceiveMessage(
            async message => {
                if (message.command === 'next') {
                    const song = currentArtist ? 
                        getRandomSong(currentArtist) : 
                        getRandomSong();
                    
                    currentGame = {
                        song,
                        maskedName: maskText(song.name),
                        maskedArtist: maskText(song.artist),
                        maskedLyrics: maskText(song.lyric),
                        guessedChars: new Set(),
                        guessCount: 0,
                        isArtistRevealed: false
                    };
                    
                    updateGameView(context);
                } else if (message.command === 'guess' && currentGame) {
                    const char = message.text;
                    
                    if (!currentGame.guessedChars.has(char)) {
                        currentGame.guessCount++;
                    }
                    
                    currentGame.guessedChars.add(char);

                    if (currentGame.song.name.includes(char) || 
                        currentGame.song.artist.includes(char) || 
                        currentGame.song.lyric.includes(char)) {
                        
                        currentGame.maskedName = revealChar(currentGame.song.name, char, currentGame.guessedChars);
                        currentGame.maskedArtist = currentGame.isArtistRevealed ? 
                            currentGame.song.artist : 
                            revealChar(currentGame.song.artist, char, currentGame.guessedChars);
                        currentGame.maskedLyrics = revealChar(currentGame.song.lyric, char, currentGame.guessedChars);

                        if (!currentGame.maskedName.includes('□')) {
                            // 显示完整信息
                            currentGame.maskedName = currentGame.song.name;
                            currentGame.maskedArtist = currentGame.song.artist;
                            currentGame.maskedLyrics = currentGame.song.lyric;
                            
                            // 更新排行榜
                            const isNewRecord = leaderboard.updateScore(currentGame.song.id, currentGame.guessCount);
                            const rank = leaderboard.getSongRank(currentGame.song.id);
                            
                            updateGameView(context);
                            
                            let message = `恭喜你猜出了歌名：${currentGame.song.name}！共猜了 ${currentGame.guessCount} 次。`;
                            if (isNewRecord) {
                                message += ' 创造了新纪录！';
                            }
                            if (rank > 0) {
                                message += ` 当前排名第 ${rank} 名。`;
                            }
                            
                            await vscode.window.showInformationMessage(message);
                            return;
                        }
                    } else {
                        vscode.window.showInformationMessage(`字符 "${char}" 不存在！`);
                    }
                    updateGameView(context);
                } else if (message.command === 'showAnswer' && currentGame) {
                    // 显示完整答案
                    currentGame.maskedName = currentGame.song.name;
                    currentGame.maskedArtist = currentGame.song.artist;
                    currentGame.maskedLyrics = currentGame.song.lyric;
                    updateGameView(context);
                    
                    await vscode.window.showInformationMessage(
                        `答案是：${currentGame.song.name} - ${currentGame.song.artist}`
                    );
                } else if (message.command === 'showArtist' && currentGame) {
                    currentGame.isArtistRevealed = true;
                    currentGame.maskedArtist = currentGame.song.artist;
                    updateGameView(context);
                    
                    await vscode.window.showInformationMessage(
                        `歌手是：${currentGame.song.artist}`
                    );
                } else if (message.command === 'searchArtist') {
                    const artist = message.text.trim();
                    const songs = getSongFromArtist(artist);
                    
                    if (songs.length > 0) {
                        currentArtist = artist;
                        await vscode.window.showInformationMessage(
                            `找到歌手 "${artist}" 的 ${songs.length} 首歌！`
                        );
                        // 立即切换到该歌手的一首歌
                        const song = getRandomSong(currentArtist);
                        currentGame = {
                            song,
                            maskedName: maskText(song.name),
                            maskedArtist: maskText(song.artist),
                            maskedLyrics: maskText(song.lyric),
                            guessedChars: new Set(),
                            guessCount: 0,
                            isArtistRevealed: false
                        };
                        updateGameView(context);
                    } else {
                        await vscode.window.showInformationMessage(
                            `未找到歌手 "${artist}" 的歌曲`
                        );
                    }
                } else if (message.command === 'clearArtist') {
                    currentArtist = undefined;
                    await vscode.window.showInformationMessage('已清除歌手筛选');
                    
                } else if (message.command === 'getHint' && currentGame) {
                    // 获取一个未显示的字符作为提示
                    const allChars = new Set([
                        ...currentGame.song.name.split(''),
                        ...currentGame.song.artist.split(''),
                        ...currentGame.song.lyric.split('')
                    ]);
                    
                    // 过滤掉已经猜过的字符和非中文字符
                    const availableChars = Array.from(allChars).filter(char => 
                        !currentGame!.guessedChars.has(char) && 
                        /[\u4e00-\u9fa5]/.test(char)
                    );
                    
                    if (availableChars.length > 0) {
                        // 随机选择一个未显示的字符
                        const hintChar = availableChars[Math.floor(Math.random() * availableChars.length)];
                        
                        // 更新游戏状态
                        currentGame.guessedChars.add(hintChar);
                        currentGame.guessCount++;
                        
                        // 更新显示
                        currentGame.maskedName = revealChar(currentGame.song.name, hintChar, currentGame.guessedChars);
                        currentGame.maskedArtist = revealChar(currentGame.song.artist, hintChar, currentGame.guessedChars);
                        currentGame.maskedLyrics = revealChar(currentGame.song.lyric, hintChar, currentGame.guessedChars);
                        
                        updateGameView(context);
                        
                        await vscode.window.showInformationMessage(`提示：字符 "${hintChar}"`);
                    } else {
                        await vscode.window.showInformationMessage('没有更多可提示的字符了！');
                    }
                } else if (message.command === 'showLeaderboard') {
                    showLeaderboard(context);
                }
            },
            undefined,
            context.subscriptions
        );

        function updateGameView(context: vscode.ExtensionContext) {
            if (!currentGame) return;
            
            const templatePath = path.join(context.extensionPath,'src', 'template.html');
            const formatText = (text: string) => text.replace(/\n/g, '<br>').trim();
            let html = fs.readFileSync(templatePath, 'utf-8');
            html = html.replace('{{currentArtist}}', currentArtist ? 
                `<div class="current-artist">当前歌手：${currentArtist}</div>` : '')
                .replace('{{clearArtistButton}}', currentArtist ? 
                    `<button onclick="clearArtist()">清除筛选</button>` : '')
                .replace('{{songId}}', currentGame.song.id.toString())
                .replace('{{maskedName}}', currentGame.maskedName)
                .replace('{{maskedArtist}}', currentGame.maskedArtist)
                .replace('{{maskedLyrics}}', formatText(currentGame.maskedLyrics))
                .replace('{{guessedChars}}', Array.from(currentGame.guessedChars).join(', '))
                .replace('{{guessCount}}', currentGame.guessCount.toString())
                .replace('</div>', `
                    <button class="next-button" onclick="showLeaderboard()">查看排行榜</button>
                </div>
            `);
        
            panel.webview.html = html;
        }

        updateGameView(context);
    });

    context.subscriptions.push(disposable);
}

// 将文本转换为遮罩（方框）
function maskText(text: string): string {
    return text.split('').map(c => 
        c.match(/[\u4e00-\u9fa5a-zA-Z]/) ? '<span class="char-box">□</span>' : c
    ).join('');
}

// 显示已猜中的字符
function revealChar(text: string, char: string, guessedChars: Set<string>): string {
    return text.split('').map(c => 
        guessedChars.has(c) ? 
            `<span class="char-box">${c}</span>` : 
            (c.match(/[\u4e00-\u9fa5a-zA-Z]/) ? '<span class="char-box">□</span>' : c)
    ).join('');
}

function showLeaderboard(context: vscode.ExtensionContext) {
    if (leaderboardPanel) {
        leaderboardPanel.reveal();
        return;
    }

    leaderboardPanel = vscode.window.createWebviewPanel(
        'lyricsLeaderboard',
        '猜歌词游戏排行榜',
        vscode.ViewColumn.One,
        {
            enableScripts: true
        }
    );

    // 创建歌曲数据库 Map
    const songDatabase = new Map(songs.map(song => [
        song.id,
        { name: song.name, artist: song.artist }
    ]));

    function updateLeaderboardView(searchText: string = '', sortBy: 'guesses' | 'time' = 'guesses') {
        const stats = leaderboard.getStats();
        const records = leaderboard.getFormattedRecords(songDatabase, searchText, sortBy);
        
        const templatePath = path.join(context.extensionPath, 'src', 'leaderboard.html');
        let html = fs.readFileSync(templatePath, 'utf-8');
        
        // 替换模板变量
        html = html
            .replace('{{totalSongs}}', stats.totalSongs.toString())
            .replace('{{averageGuesses}}', stats.averageGuesses.toString())
            .replace('{{bestRecord}}', stats.bestRecord.toString())
            .replace('{{#each records}}', '')
            .replace('{{/each}}', '');

        // 插入记录
        const recordsHtml = records.map((record: LeaderboardRecord) => `
            <tr>
                <td class="rank">${record.rank}</td>
                <td>${record.songName}</td>
                <td>${record.artist}</td>
                <td>${record.guesses}</td>
                <td>${record.timestamp}</td>
            </tr>
        `).join('');

        html = html.replace('<tbody id="recordsBody">', `<tbody id="recordsBody">${recordsHtml}`);
        
        leaderboardPanel!.webview.html = html;
    }

    leaderboardPanel.webview.onDidReceiveMessage(
        async message => {
            switch (message.command) {
                case 'backToGame':
                    leaderboardPanel?.dispose();
                    gamePanel?.reveal();
                    break;
                case 'filterRecords':
                    updateLeaderboardView(message.text, message.sortBy);
                    break;
                case 'sortRecords':
                    updateLeaderboardView(message.searchText, message.sortBy);
                    break;
            }
        },
        undefined,
        context.subscriptions
    );

    leaderboardPanel.onDidDispose(() => {
        leaderboardPanel = undefined;
    });

    updateLeaderboardView();
}

export function deactivate() {}