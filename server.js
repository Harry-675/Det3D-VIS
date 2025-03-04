const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const port = 3000;

// 启用CORS
app.use(cors());

// 静态文件服务 - 当前目录
app.use(express.static('./'));

// 提供文件路径API
app.get('/file', (req, res) => {
    const filePath = req.query.path;

    if (!filePath) {
        return res.status(400).json({ error: '未提供文件路径' });
    }

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: '文件不存在' });
    }

    // 根据文件扩展名设置正确的Content-Type
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') {
        res.setHeader('Content-Type', 'image/jpeg');
    } else if (ext === '.png') {
        res.setHeader('Content-Type', 'image/png');
    } else if (ext === '.pcd') {
        res.setHeader('Content-Type', 'application/octet-stream');
    } else if (ext === '.json') {
        res.setHeader('Content-Type', 'application/json');
    } else if (ext === '.cfg' || ext === '.txt') {
        res.setHeader('Content-Type', 'text/plain');
    }

    // 发送文件
    fs.createReadStream(filePath).pipe(res);
});

app.listen(port, () => {
    console.log(`文件服务器运行在 http://localhost:${port}`);
}); 