import * as vscode from 'vscode';
import { Song, getRandomSong, loadSongs, getSongFromArtist } from './songDatabase';

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
                    
                    updateGameView();
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
                            updateGameView();
                            
                            await vscode.window.showInformationMessage(
                                `恭喜你猜出了歌名：${currentGame.song.name}！共猜了 ${currentGame.guessCount} 次。`
                            );
                            return;
                        }
                    } else {
                        vscode.window.showInformationMessage(`字符 "${char}" 不存在！`);
                    }
                    updateGameView();
                } else if (message.command === 'showAnswer' && currentGame) {
                    // 显示完整答案
                    currentGame.maskedName = currentGame.song.name;
                    currentGame.maskedArtist = currentGame.song.artist;
                    currentGame.maskedLyrics = currentGame.song.lyric;
                    updateGameView();
                    
                    await vscode.window.showInformationMessage(
                        `答案是：${currentGame.song.name} - ${currentGame.song.artist}`
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
                        updateGameView();
                    } else {
                        await vscode.window.showInformationMessage(
                            `未找到歌手 "${artist}" 的歌曲`
                        );
                    }
                } else if (message.command === 'clearArtist') {
                    currentArtist = undefined;
                    await vscode.window.showInformationMessage('已清除歌手筛选');
                    
                }
            },
            undefined,
            context.subscriptions
        );

        function updateGameView() {
            if (!currentGame) return;
            
            const formatText = (text: string) => text.replace(/\n/g, '<br>').trim();
            
            panel.webview.html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { 
                            padding: 20px; 
                            background-color: #1e1e1e;
                            color: #ffffff;
                        }
                        .game-container { 
                            max-width: 800px; 
                            margin: 0 auto; 
                        }
                        .input-container { 
                            margin: 20px 0; 
                        }
                        input { 
                            padding: 5px; 
                            font-size: 16px;
                            background-color: #2d2d2d;
                            color: #ffffff;
                            border: 1px solid #3d3d3d;
                        }
                        button { 
                            padding: 5px 10px; 
                            margin-left: 10px;
                            background-color: #0e639c;
                            color: white;
                            border: none;
                            cursor: pointer;
                        }
                        button:hover {
                            background-color: #1177bb;
                        }
                        .masked-text { 
                            font-size: 18px; 
                            line-height: 1.6;
                            white-space: pre-wrap;
                        }
                        .next-button { 
                            display: block; 
                            margin: 20px 0;
                            padding: 10px 20px;
                            background-color: #0e639c;
                            color: white;
                            border: none;
                            cursor: pointer;
                        }
                        .next-button:hover {
                            background-color: #1177bb;
                        }
                        .lyrics-container {
                            margin: 20px 0;
                            padding: 15px;
                            background-color: #2d2d2d;
                            border-radius: 5px;
                            border: 1px solid #3d3d3d;
                            text-align: left;
                        }
                        .lyrics-text {
                            margin: 0;
                            padding: 0;
                            line-height: 1.6;
                        }
                        h2 {
                            color: #cccccc;
                        }
                        .search-container {
                            margin: 20px 0;
                            display: flex;
                            gap: 10px;
                        }
                        .current-artist {
                            margin: 10px 0;
                            color: #0e639c;
                        }
                    </style>
                </head>
                <body>
                    <div class="game-container">
                        <h2>猜歌词游戏</h2>
                        ${currentArtist ? 
                            `<div class="current-artist">当前歌手：${currentArtist}</div>` : 
                            ''
                        }
                        <div class="search-container">
                            <input type="text" id="artistInput" placeholder="输入歌手名字">
                            <button onclick="searchArtist()">搜索歌手</button>
                            ${currentArtist ? 
                                `<button onclick="clearArtist()">清除筛选</button>` : 
                                ''
                            }
                        </div>
                        <div class="masked-text">
                            <p>歌曲编号：${currentGame.song.id}</p>
                            <p>歌名：${currentGame.maskedName}</p>
                            <p>歌手：${currentGame.maskedArtist}</p>
                            <div class="lyrics-container">
                                <div class="lyrics-text">
                                    ${formatText(currentGame.maskedLyrics)}
                                </div>
                            </div>
                            <p>已猜过的字：${Array.from(currentGame.guessedChars).join(', ')}</p>
                            <p>已猜字次数：${currentGame.guessCount}</p>
                        </div>
                        <div class="input-container">
                            <input type="text" id="guessInput" maxlength="1" placeholder="输入一个汉字">
                            <button onclick="submitGuess()">猜！</button>
                        </div>
                        <button class="next-button" onclick="showAnswer()">显示答案</button>
                        <button class="next-button" onclick="nextSong()">下一首歌</button>
                    </div>
                    <script>
                        const vscode = acquireVsCodeApi();
                        
                        document.getElementById('guessInput').addEventListener('keypress', (e) => {
                            if (e.key === 'Enter') {
                                submitGuess();
                            }
                        });

                        function submitGuess() {
                            const input = document.getElementById('guessInput');
                            const char = input.value.trim();
                            if (char) {
                                vscode.postMessage({
                                    command: 'guess',
                                    text: char[0]
                                });
                                input.value = '';
                            }
                        }

                        function nextSong() {
                            vscode.postMessage({
                                command: 'next'
                            });
                        }

                        function showAnswer() {
                            vscode.postMessage({
                                command: 'showAnswer'
                            });
                        }

                        function searchArtist() {
                            const input = document.getElementById('artistInput');
                            const artist = input.value.trim();
                            if (artist) {
                                vscode.postMessage({
                                    command: 'searchArtist',
                                    text: artist
                                });
                                input.value = '';
                            }
                        }
                        
                        function clearArtist() {
                            vscode.postMessage({
                                command: 'clearArtist'
                            });
                        }
                    </script>
                </body>
                </html>
            `;
        }

        updateGameView();
    });

    context.subscriptions.push(disposable);
}

// 将文本转换为遮罩（方框）
function maskText(text: string): string {
    return text.replace(/[\u4e00-\u9fa5a-zA-Z]/g, '□');
}

// 显示已猜中的字符
function revealChar(text: string, char: string, guessedChars: Set<string>): string {
    return text.split('').map(c => 
        guessedChars.has(c) ? c : (c.match(/[\u4e00-\u9fa5a-zA-Z]/) ? '□' : c)
    ).join('');
}

export function deactivate() {}