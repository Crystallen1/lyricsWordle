import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface ScoreRecord {
    songId: number;
    minGuesses: number;
    timestamp: number;
}

export interface LeaderboardRecord {
    rank: number;
    songId: number;
    songName: string;
    artist: string;
    guesses: number;
    timestamp: string;
}

interface LeaderboardStats {
    totalSongs: number;
    averageGuesses: number;
    bestRecord: number;
}

export class Leaderboard {
    private scores: Map<number, ScoreRecord>;
    private filePath: string;

    constructor(context: vscode.ExtensionContext) {
        this.scores = new Map();
        this.filePath = path.join(context.globalStorageUri.fsPath, 'leaderboard.json');
        this.loadScores();
    }

    private loadScores(): void {
        try {
            // 确保目录存在
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // 读取文件
            if (fs.existsSync(this.filePath)) {
                const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
                this.scores = new Map(Object.entries(data).map(([id, record]) => [
                    parseInt(id),
                    record as ScoreRecord
                ]));
            }
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
        }
    }

    private saveScores(): void {
        try {
            const data = Object.fromEntries(this.scores);
            fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Failed to save leaderboard:', error);
        }
    }

    // 更新分数
    public updateScore(songId: number, guesses: number): boolean {
        const currentRecord = this.scores.get(songId);
        let isNewRecord = false;

        if (!currentRecord || guesses < currentRecord.minGuesses) {
            this.scores.set(songId, {
                songId,
                minGuesses: guesses,
                timestamp: Date.now()
            });
            isNewRecord = true;
            this.saveScores();
        }

        return isNewRecord;
    }

    // 获取某首歌的最佳记录
    public getScore(songId: number): ScoreRecord | undefined {
        return this.scores.get(songId);
    }

    // 获取所有记录
    public getAllScores(): ScoreRecord[] {
        return Array.from(this.scores.values());
    }

    // 获取前N名记录
    public getTopScores(limit: number = 10): ScoreRecord[] {
        return Array.from(this.scores.values())
            .sort((a, b) => a.minGuesses - b.minGuesses)
            .slice(0, limit);
    }

    // 获取某首歌在排行榜中的排名
    public getSongRank(songId: number): number {
        const currentScore = this.scores.get(songId);
        if (!currentScore) {
            return -1;
        }

        const allScores = Array.from(this.scores.values())
            .sort((a, b) => a.minGuesses - b.minGuesses);
        
        return allScores.findIndex(score => score.songId === songId) + 1;
    }

    // 获取统计数据
    public getStats(): LeaderboardStats {
        const scores = Array.from(this.scores.values());
        const totalSongs = scores.length;
        const totalGuesses = scores.reduce((sum, record) => sum + record.minGuesses, 0);
        const bestRecord = scores.reduce((min, record) => 
            Math.min(min, record.minGuesses), Infinity);

        return {
            totalSongs,
            averageGuesses: totalSongs > 0 ? Math.round((totalGuesses / totalSongs) * 10) / 10 : 0,
            bestRecord: bestRecord === Infinity ? 0 : bestRecord
        };
    }

    // 获取格式化的记录列表
    public getFormattedRecords(songDatabase: Map<number, { name: string, artist: string }>, 
                             searchText: string = '', 
                             sortBy: 'guesses' | 'time' = 'guesses'): LeaderboardRecord[] {
        let records = Array.from(this.scores.values())
            .map(score => {
                const song = songDatabase.get(score.songId);
                if (!song) return null;
                
                return {
                    rank: 0, // 将在排序后设置
                    songId: score.songId,
                    songName: song.name,
                    artist: song.artist,
                    guesses: score.minGuesses,
                    timestamp: new Date(score.timestamp).toLocaleString('zh-CN')
                };
            })
            .filter((record): record is LeaderboardRecord => record !== null);

        // 应用搜索过滤
        if (searchText) {
            const search = searchText.toLowerCase();
            records = records.filter(record => 
                record.songName.toLowerCase().includes(search) || 
                record.artist.toLowerCase().includes(search)
            );
        }

        // 应用排序
        records.sort((a, b) => {
            if (sortBy === 'time') {
                return b.timestamp.localeCompare(a.timestamp);
            }
            return a.guesses - b.guesses;
        });

        // 设置排名
        records.forEach((record, index) => {
            record.rank = index + 1;
        });

        return records;
    }
} 