import * as vscode from 'vscode';
import { Song, getRandomSong, loadSongs, getSongFromArtist } from './songDatabase';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
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
            guessCount: 0
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
                    // 获取新歌曲，根据是否有选中歌手来决定
                    const song = currentArtist ? 
                        getRandomSong(currentArtist) : 
                        getRandomSong();
                    
                    // 重置游戏状态
                    currentGame = {
                        song,
                        maskedName: maskText(song.name),
                        maskedArtist: maskText(song.artist),
                        maskedLyrics: maskText(song.lyric),
                        guessedChars: new Set(),
                        guessCount: 0
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
                        currentGame.maskedArtist = revealChar(currentGame.song.artist, char, currentGame.guessedChars);
                        currentGame.maskedLyrics = revealChar(currentGame.song.lyric, char, currentGame.guessedChars);

                        if (!currentGame.maskedName.includes('□')) {
                            // 显示完整信息
                            currentGame.maskedName = currentGame.song.name;
                            currentGame.maskedArtist = currentGame.song.artist;
                            currentGame.maskedLyrics = currentGame.song.lyric;
                            updateGameView(context);
                            
                            await vscode.window.showInformationMessage(
                                `恭喜你猜出了歌名：${currentGame.song.name}！共猜了 ${currentGame.guessCount} 次。`
                            );
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
                    // 只显示歌手名字
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
                            guessCount: 0
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
                .replace('{{guessCount}}', currentGame.guessCount.toString());
        
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

export function deactivate() {}