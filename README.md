# 点云与图像查看器

一个用于查看和分析点云数据及其对应相机图像的Web应用。支持点云显示、多相机图像查看、点云投影到图像等功能。

## 功能特点

- 点云数据可视化
  - 支持PCD格式点云文件
  - 基于高度的彩色渲染
  - 显示距离参考圆圈
  - 支持旋转、平移、缩放操作

- 多相机图像显示
  - 支持多个相机视角的图像显示
  - 图像查看器支持缩放和平移
  - 支持点云到图像的投影显示

- 数据导航
  - 支持单个文件加载
  - 支持目录批量加载
  - 帧导航和切换功能
  - 帧序号快速跳转

## 快速开始

1. 克隆仓库：
   ```bash
   git clone https://github.com/yourusername/pointcloud-viewer.git
   cd pointcloud-viewer
   ```

2. 启动服务器：
   ```bash
   # 使用 Python 3
   python -m http.server 8000

   # 或使用 Python 2
   python -m SimpleHTTPServer 8000
   ```

3. 在浏览器中访问：
   ```
   http://localhost:8000
   ```

## 依赖库

- Three.js r128
- Three.js OrbitControls
- Three.js PCDLoader
- Three.js FontLoader

## 浏览器兼容性

- Chrome (推荐)
- Firefox
- Safari
- Edge

## 数据格式要求

1. JSON文件格式：
   ```json
   {
       "frame": {
           "pcd": "path/to/pointcloud.pcd",
           "cam_1": "path/to/camera1.jpg",
           "cam_2": "path/to/camera2.jpg",
           "cam_3": "path/to/camera3.jpg",
           "calib1": "path/to/calibration1.json",
           "calib2": "path/to/calibration2.json",
           "calib3": "path/to/calibration3.json"
       }
   }
   ```

2. 标定文件格式：
   ```json
   {
       "intrinsic": [
           fx, 0, cx,
           0, fy, cy,
           0, 0, 1
       ],
       "extrinsic": [
           r11, r12, r13, t1,
           r21, r22, r23, t2,
           r31, r32, r33, t3,
           0, 0, 0, 1
       ]
   }
   ```

## 注意事项

1. 确保数据文件路径正确
2. JSON文件需要按顺序命名以保证正确排序
3. 所有路径应为相对于JSON文件的相对路径
4. 标定文件中的矩阵应为行主序
5. 需要启动本地服务器来运行，直接打开HTML文件可能无法正常工作

## 操作说明

### 点云控制
- 左键拖动：旋转视角
- 右键拖动：平移视角
- 滚轮：缩放
- Ctrl/Cmd + 左键：平移

### 图像查看
- 点击图像：打开查看器
- 滚轮：缩放图像
- 拖动：平移图像
- 点击关闭按钮：退出查看器

### 数据导航
- Open File：选择单个JSON文件
- Open Directory：选择包含多个JSON文件的目录
- Previous/Next：切换上一帧/下一帧
- 点击帧号：快速跳转到指定帧

## 项目结构