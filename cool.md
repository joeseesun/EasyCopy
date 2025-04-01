# EasyCopy 功能文档

## 正常运行的功能

### 1. 单击图标复制

**实现方式**：
- 通过 Chrome 扩展的 `action.onClicked` 事件监听器触发
- 在 `background.js` 中实现，使用 `chrome.action.onClicked.addListener` 监听点击事件

**关键函数**：
- `copyTabs(scope, format)`: 主要复制函数，处理不同格式的复制请求
- `formatTabData(tab, format)`: 将标签页数据格式化为指定格式
- `showBadge(text, color)`: 显示操作反馈徽章

**代码片段**：
```javascript
// 监听扩展图标点击事件
chrome.action.onClicked.addListener(async (tab) => {
  // 默认复制当前标签页的标题和URL
  await copyTabs('this_tab', 'title_url');
});
```

### 2. 三击图标弹窗中的复制标题功能

**实现方式**：
- 监听扩展图标的点击次数，三次点击时显示高级弹出窗口
- 在高级弹出窗口中提供多种格式选项
- 使用 `chrome.runtime.sendMessage` 发送复制请求到后台脚本

**关键函数**：
- `copyWithCurrentSelection(type)`: 使用当前选择的范围和格式执行复制操作
- `copyTextToClipboard(text)`: 将文本复制到剪贴板
- `showStatus(message, type)`: 显示操作状态反馈

**代码片段**：
```javascript
// 处理标题格式选择
formatOptions.forEach(option => {
  option.addEventListener('click', function() {
    // 移除其他选项的活动状态
    formatOptions.forEach(opt => opt.classList.remove('active'));
    // 添加当前选项的活动状态
    this.classList.add('active');
    // 更新选择的格式
    selectedFormat = this.dataset.format;
    // 执行复制操作
    copyWithCurrentSelection('title');
  });
});
```

### 3. 成功和失败反馈提示样式和位置

**实现方式**：
- 使用固定定位的 CSS 样式，将提示显示在视口底部
- 添加动画效果，使提示平滑显示和隐藏
- 使用 JavaScript 控制提示的显示和隐藏

**关键函数**：
- `showStatus(message, type)`: 显示操作状态反馈
- `showBadge(text, color)`: 在扩展图标上显示操作反馈徽章

**CSS 样式**：
```css
.status {
  padding: 10px 20px;
  background-color: #e6f7f2;
  color: var(--primary-color);
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  display: none;
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-width: 90%;
}

.status.visible {
  display: block;
  animation: fadeIn 0.3s ease-in-out;
}
```

## 不可用功能

### 1. 双击复制可读内容

**问题描述**：
双击扩展图标应该复制当前页面的可读内容，但此功能目前不可用。

**预期实现方式**：
- 监听扩展图标的双击事件
- 使用 Readability.js 提取页面的可读内容
- 复制到剪贴板并显示反馈

**关键函数（需要修复）**：
- `copyReadableContent(tabId)`: 使用 Readability 提取并复制可读内容

### 2. 三击图标弹窗中的复制内容功能

**问题描述**：
在高级弹出窗口中，"复制内容为"部分下的"可读内容"和"完整HTML"选项目前不可用，点击后无法正确复制内容。

**预期实现方式**：
- 使用 Readability.js 提取页面的可读内容或完整 HTML
- 通过消息传递机制将内容发送到后台脚本
- 将内容存储到本地存储并复制到剪贴板

**关键函数（需要修复）**：
- `copyContent(format)`: 处理不同格式的内容复制请求
- `copyReadableContent(tabId)`: 使用 Readability 提取并复制可读内容
- `copyFullHtml(tabId)`: 提取并复制页面的完整 HTML

## 修复思路

### 1. Readability.js 引用问题

**问题分析**：
Readability.js 无法正确加载是因为：
1. 文件未被声明为 web accessible resource
2. 加载方式不够健壮，没有等待确认加载完成
3. 缺少错误处理和重试机制

**解决方案**：
1. 在 manifest.json 中添加 web_accessible_resources 配置：
```json
"web_accessible_resources": [
  {
    "resources": ["Readability.js"],
    "matches": ["<all_urls>"]
  }
]
```

2. 改进 Readability.js 的加载方式：
```javascript
// 获取Readability.js的URL
const readabilityUrl = chrome.runtime.getURL('Readability.js');

// 注入Readability库
await chrome.scripting.executeScript({
  target: { tabId: activeTab.id },
  func: (readabilityUrl) => {
    return new Promise((resolve, reject) => {
      try {
        // 创建script元素
        const script = document.createElement('script');
        script.src = readabilityUrl;
        script.onload = () => {
          console.log('Readability.js loaded successfully');
          resolve(true);
        };
        script.onerror = (error) => {
          console.error('Failed to load Readability.js:', error);
          reject(error);
        };
        document.head.appendChild(script);
      } catch (error) {
        console.error('Error injecting Readability.js:', error);
        reject(error);
      }
    });
  },
  args: [readabilityUrl]
});
```

### 2. 复制内容功能修复

**问题分析**：
复制功能不可用可能是因为：
1. 内容脚本执行顺序问题
2. Readability 库未正确加载
3. 错误处理不完善

**解决方案**：
1. 重构内容提取和复制流程，使用 Promise 确保操作按顺序执行
2. 添加等待和重试机制，确保 Readability 库加载完成
3. 改进错误处理和日志记录

### 3. 提示位置问题

**问题分析**：
状态提示固定在弹层底部，而不是在可视窗口底部，影响用户体验。

**解决方案**：
修改 CSS 样式，使提示显示在视口底部：
```css
.status {
  /* 原有样式 */
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-width: 90%;
}
```

## 下一步计划

1. **修复双击复制可读内容功能**：
   - 实现双击事件监听
   - 确保 Readability.js 正确加载
   - 优化内容提取逻辑

2. **完善三击弹窗中的复制内容功能**：
   - 确保消息传递机制正常工作
   - 改进错误处理和用户反馈
   - 添加更多内容格式选项

3. **增强用户体验**：
   - 添加更多自定义选项
   - 优化性能和响应速度
   - 提供更直观的用户界面
