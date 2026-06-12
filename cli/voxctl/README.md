# Vox CLI Player (Voxctl)

macOS CLI 音乐播放器，对接 Vox 音乐库（原 Polaris）。

## 依赖

- [mpv](https://mpv.io/) — `brew install mpv`
- Node.js (v18+) — bundled 或 `brew install node`

## 安装

```bash
# 建立软链（一次性）
ln -sf ~/code/vox/cli/voxctl/voxctl.sh /usr/local/bin/voxctl
```

Fish 自动补全已安装至 `~/.config/fish/completions/voxctl.fish`，新开终端或 `exec fish` 生效。

LaunchAgent 已加载（开机自启 mpv，暂停状态）：`com.vox.mpv`

## 用法

### 播放控制

```bash
# 搜索并播放歌曲（支持简繁中文）
voxctl play 消愁
voxctl play "Bohemian Rhapsody"

# 控制
voxctl pause / resume / toggle / stop
voxctl next / prev

# 导航
voxctl seek +10
voxctl seek -30

# 音量（mpv + macOS 系统音量分列显示）
voxctl volume 60
```

### 队列

```bash
voxctl list              # 显示队列
voxctl queue "漠河舞厅"  # 加入队列
voxctl shuffle           # 随机播放
```

### 播放列表（Vox API）

```bash
voxctl playlist          # 加载 fav 播放列表（默认）
voxctl playlist mylist   # 加载指定列表
voxctl pl-add 消愁       # 添加到当前播放列表
voxctl pl-remove 消愁    # 从当前播放列表移除
```

### 信息 & 搜索

```bash
voxctl status / now     # 当前播放信息
voxctl search 陈奕迅    # 搜索音乐库
voxctl help
```

## 架构

- **音频后端**：`mpv --no-video` 守护进程，Unix IPC socket 控制
- **音乐源**：Vox 服务器 `http://192.168.100.1:5050`
- **封面**：mpv Lua hook (`cover-hook.lua`) 在 `on_load` 时阻塞下载封面并设置
- **状态**：实时从 mpv IPC 或 Vox API 读取，无本地缓存
- **日志**：`/tmp/vox-player/player.log`

## 媒体键

| 键                  | 无歌时                   | 有歌时        |
|:--------------------|:-------------------------|:--------------|
| **Play/媒体播放键** | 加载 fav 列表 + 随机播放 | 切换暂停/播放 |
