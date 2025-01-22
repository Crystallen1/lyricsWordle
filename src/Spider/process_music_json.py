import json
import os
import re

def clean_lyric(lyric):
    # 分割歌词为行
    lines = lyric.split('\\n')
    
    # 跳过包含以下关键词的行
    skip_keywords = ['作词', '作曲', '编曲', '制作', '词：', '曲：', '-', '：', ':','翻唱','授权']
    
    # 找到第一行实际歌词
    start_index = 0
    for i, line in enumerate(lines):
        # 跳过空行
        if not line.strip():
            continue
        # 检查是否包含需要跳过的关键词
        if any(keyword in line for keyword in skip_keywords):
            continue
        start_index = i
        break
    
    # 获取实际歌词部分
    cleaned_lyrics = lines[start_index:]
    
    # 将\\n替换为\n
    return '\n'.join(cleaned_lyrics)

def should_skip_song(song_name):
    """
    检查歌名是否应该被过滤掉
    """
    # 包含括号
    if '(' in song_name or ')' in song_name:
        return True
        
    # 包含英文字母
    if re.search(r'[a-zA-Z]', song_name):
        return True
        
    # 包含"串烧"
    if '串烧' in song_name:
        return True
        
    return False

def process_music_data(input_file, output_file):
    # 读取JSON文件
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 处理后的数据列表
    processed_data = []
    
    # 先处理和过滤数据
    for item in data:
        # 跳过singer_name长度大于1的记录
        if len(item['singer_name']) > 1:
            continue
            
        # 检查歌名是否应该被过滤
        if should_skip_song(item['song_name']):
            continue
            
        # 创建新的记录，使用新的字段名
        new_item = {
            'name': item['song_name'],
            'artist': item['singer_name'][0],
            'lyric': clean_lyric(item['lyric'])
        }
        
        # 如果清理后的歌词为空，跳过该记录
        if not new_item['lyric'].strip():
            continue
            
        processed_data.append(new_item)
    
    # 添加id字段
    final_data = []
    for idx, item in enumerate(processed_data, start=26):
        item['id'] = idx
        final_data.append(item)
    
    # 写入新的JSON文件
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)
    
    print(f"原始数据条数: {len(data)}")
    print(f"处理后数据条数: {len(final_data)}")
    print(f"处理后的数据已保存到: {output_file}")

def main():
    # 获取当前脚本所在目录
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 设置输入输出文件路径
    input_file = os.path.join(current_dir, 'data', 'music.json')
    output_file = os.path.join(current_dir, 'data', 'music_processed.json')
    
    # 处理数据
    process_music_data(input_file, output_file)

if __name__ == "__main__":
    main() 