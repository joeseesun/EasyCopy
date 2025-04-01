/**
 * EasyCopy - Content Script
 * 使用Readability提取网页核心内容并复制到剪贴板
 */

function copyReadableContent() {
  try {
    // 克隆文档以避免修改原始DOM
    const documentClone = document.cloneNode(true);
    
    // 使用Readability解析网页内容
    const article = new Readability(documentClone).parse();
    
    if (!article) {
      throw new Error('无法提取页面内容');
    }
    
    // 准备要复制的文本
    const titleText = article.title.trim();
    const contentText = article.textContent.trim();
    const urlText = window.location.href;
    
    const textToCopy = `标题：${titleText}\n来源：${urlText}\n\n${contentText}`;
    
    // 使用传统方法复制文本，避免焦点问题
    copyTextFallback(textToCopy);
    
    // 注释掉现代API方法，因为它需要文档获得焦点
    // if (location.protocol === 'https:') {
    //   navigator.clipboard.writeText(textToCopy)
    //     .then(() => {
    //       // 向background脚本发送成功消息
    //       chrome.runtime.sendMessage({ action: 'copySuccess' });
    //     })
    //     .catch(error => {
    //       console.error('复制失败（现代API）:', error);
    //       // 尝试使用传统方法
    //       copyTextFallback(textToCopy);
    //     });
    // } else {
    //   // 对于HTTP页面，使用传统方法
    //   copyTextFallback(textToCopy);
    // }
  } catch (error) {
    console.error('提取或复制内容时出错:', error);
    chrome.runtime.sendMessage({ action: 'copyError', error: error.message });
  }
}

/**
 * 使用传统方法复制文本（用于不支持Clipboard API的情况）
 * @param {string} text - 要复制的文本
 */
function copyTextFallback(text) {
  try {
    // 创建一个临时的textarea元素
    const textarea = document.createElement('textarea');
    textarea.value = text;
    
    // 设置样式使其不可见
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.left = '0';
    textarea.style.top = '0';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    
    // 添加到文档中
    document.body.appendChild(textarea);
    
    // 选中文本
    textarea.focus();
    textarea.select();
    
    // 尝试复制
    const successful = document.execCommand('copy');
    
    // 移除临时元素
    document.body.removeChild(textarea);
    
    // 发送结果消息
    if (successful) {
      chrome.runtime.sendMessage({ action: 'copySuccess' });
    } else {
      chrome.runtime.sendMessage({ action: 'copyError', error: '复制命令失败' });
    }
  } catch (error) {
    console.error('复制失败（传统方法）:', error);
    chrome.runtime.sendMessage({ action: 'copyError', error: error.message });
  }
}

// 执行复制操作
copyReadableContent();
