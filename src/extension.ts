import * as vscode from 'vscode';
import { Song, getRandomSong } from './songDatabase';

export function activate(context: vscode.ExtensionContext) {
    let currentGame: {
        song: Song;
        maskedName: string;
        maskedArtist: string;
        maskedLyrics: string;
        guessedChars: Set<string>;
        guessCount: number;
    } | undefined;

    let disposable = vscode.commands.registerCommand('lyrics-guess.startGame', async () => {
        const song = getRandomSong();
        
        currentGame = {
            song,
            maskedName: maskText(song.name),
            maskedArtist: maskText(song.artist),
            maskedLyrics: maskText(song.lyrics),
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
                    // 获取新歌曲
                    const song = getRandomSong();
                    
                    // 重置游戏状态
                    currentGame = {
                        song,
                        maskedName: maskText(song.name),
                        maskedArtist: maskText(song.artist),
                        maskedLyrics: maskText(song.lyrics),
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
                        currentGame.song.lyrics.includes(char)) {
                        
                        currentGame.maskedName = revealChar(currentGame.song.name, char, currentGame.guessedChars);
                        currentGame.maskedArtist = revealChar(currentGame.song.artist, char, currentGame.guessedChars);
                        currentGame.maskedLyrics = revealChar(currentGame.song.lyrics, char, currentGame.guessedChars);

                        if (!currentGame.maskedName.includes('_')) {
                            // 显示完整信息
                            currentGame.maskedName = currentGame.song.name;
                            currentGame.maskedArtist = currentGame.song.artist;
                            currentGame.maskedLyrics = currentGame.song.lyrics;
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
                }
            },
            undefined,
            context.subscriptions
        );

        function updateGameView() {
            if (!currentGame) return;
            
            panel.webview.html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { padding: 20px; }
                        .game-container { max-width: 600px; margin: 0 auto; }
                        .input-container { margin: 20px 0; }
                        input { padding: 5px; font-size: 16px; }
                        button { padding: 5px 10px; margin-left: 10px; }
                        .masked-text { font-size: 18px; letter-spacing: 2px; }
                        .next-button { 
                            display: block; 
                            margin: 20px 0;
                            padding: 10px 20px;
                            background-color: #007acc;
                            color: white;
                            border: none;
                            cursor: pointer;
                        }
                        .next-button:hover {
                            background-color: #005999;
                        }
                    </style>
                </head>
                <body>
                    <div class="game-container">
                        <h2>猜歌词游戏</h2>
                        <div class="masked-text">
                            <p>歌曲编号：${currentGame.song.id}</p>
                            <p>歌名：${currentGame.maskedName}</p>
                            <p>歌手：${currentGame.maskedArtist}</p>
                            <p>歌词：${currentGame.maskedLyrics}</p>
                            <p>已猜过的字：${Array.from(currentGame.guessedChars).join(', ')}</p>
                            <p>已猜字次数：${currentGame.guessCount}</p>
                        </div>
                        <div class="input-container">
                            <input type="text" id="guessInput" maxlength="1" placeholder="输入一个汉字">
                            <button onclick="submitGuess()">猜！</button>
                        </div>
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
                    </script>
                </body>
                </html>
            `;
        }

        updateGameView();
    });

    context.subscriptions.push(disposable);
}

// 将文本转换为遮罩（下划线）
function maskText(text: string): string {
    return text.replace(/[\u4e00-\u9fa5a-zA-Z]/g, '_');
}

// 显示已猜中的字符
function revealChar(text: string, char: string, guessedChars: Set<string>): string {
    return text.split('').map(c => 
        guessedChars.has(c) ? c : (c.match(/[\u4e00-\u9fa5a-zA-Z]/) ? '_' : c)
    ).join('');
}

export function deactivate() {}