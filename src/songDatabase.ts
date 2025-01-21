import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface Song {
    id: number;
    name: string;
    artist: string;
    lyrics: string;
}

let songs: Song[] = [];

// 加载歌曲数据
export function loadSongs(context: vscode.ExtensionContext): void {
    const dataPath = path.join(context.extensionPath, 'src', 'data', 'songs.json');
    try {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        songs = data.songs;
    } catch (error) {
        console.error('Failed to load songs:', error);
    }
}

// 通过ID获取歌曲
export function getSongById(id: number): Song | undefined {
    return songs.find(song => song.id === id);
}

// 获取随机歌曲
export function getRandomSong(): Song {
    return songs[Math.floor(Math.random() * songs.length)];
}

// 获取所有歌曲数量
export function getSongCount(): number {
    return songs.length;
} 