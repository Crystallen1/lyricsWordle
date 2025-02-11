import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface Song {
    id: number;
    name: string;
    artist: string;
    lyric: string;
}

export let songs: Song[] = [];

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
export function getRandomSong(artist?: string): Song {
    if (artist) {
        const artistSongs = songs.filter(song => song.artist === artist);
        return artistSongs[Math.floor(Math.random() * artistSongs.length)];
    }
    return songs[Math.floor(Math.random() * songs.length)];
}

// 获取所有歌曲数量
export function getSongCount(): number {
    return songs.length;
} 

export function getSongFromArtist(artist:string): string[] {
    return songs.filter(song => song.artist === artist).map(song => song.name);
}