/**
 * EasyCopy Advanced Popup
 * 处理高级弹出窗口的交互和复制功能
 * Medium 风格简约设计
 */

document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const scopeOptions = document.querySelectorAll('.segment');
  const formatOptions = document.querySelectorAll('.format-option:not(.content-option)');
  const contentOptions = document.querySelectorAll('.content-option');
  const copyAsHeaders = document.querySelectorAll('.copy-as-header');
  const formatOptionsContainers = document.querySelectorAll('.format-options');
  const statusElement = document.getElementById('status');
  
  // 当前选择的范围和格式
  let selectedScope = 'this_tab'; // 默认选中 This tab
  let selectedFormat = null; // 默认不选中任何格式
  
  // 初始化 - 默认展开格式选项
  copyAsHeaders.forEach(header => {
    header.classList.add('expanded');
  });
  
  // 初始化时确保格式选项容器是可见的
  formatOptionsContainers.forEach(container => {
    container.style.display = 'flex';
  });
  
  // 切换格式选项的显示/隐藏
  copyAsHeaders.forEach(header => {
    header.addEventListener('click', function() {
      this.classList.toggle('expanded');
      const nextContainer = this.nextElementSibling;
      if (nextContainer && nextContainer.classList.contains('format-options')) {
        nextContainer.style.display = this.classList.contains('expanded') ? 'flex' : 'none';
      }
    });
  });
  
  // 处理范围选择
  scopeOptions.forEach(option => {
    option.addEventListener('click', function() {
      // 移除其他选项的活动状态
      scopeOptions.forEach(opt => opt.classList.remove('active'));
      // 添加当前选项的活动状态
      this.classList.add('active');
      // 更新选择的范围
      selectedScope = this.dataset.scope;
      
      // 如果已经选择了格式，才执行复制操作
      if (selectedFormat) {
        copyWithCurrentSelection();
      } else {
        // 提示用户选择一种格式
        showStatus('请选择一种复制格式', 'info');
      }
    });
  });
  
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
  
  // 处理内容格式选择
  contentOptions.forEach(option => {
    option.addEventListener('click', function() {
      // 移除其他选项的活动状态
      contentOptions.forEach(opt => opt.classList.remove('active'));
      // 添加当前选项的活动状态
      this.classList.add('active');
      // 更新选择的格式
      selectedFormat = this.dataset.format;
      // 执行复制操作
      copyWithCurrentSelection('content');
    });
  });
  
  // 使用当前选择执行复制操作
  function copyWithCurrentSelection(type = 'title') {
    console.log('Executing copy with current selection');
    
    // 显示正在复制的状态
    showStatus('正在复制...', 'info');
    
    // 如果没有选择格式，则不执行复制
    if (!selectedFormat) {
      console.warn('No format selected, skipping copy operation');
      showStatus('请选择复制格式', 'info');
      return;
    }
    
    // 将范围映射到background.js中使用的值
    const scopeMap = {
      'this_tab': 'this_tab',
      'window_tabs': 'window_tabs',
      'all_tabs': 'all_tabs'
    };
    
    // 确保格式映射正确
    const formatMap = {
      'url': 'url',
      'title': 'title',
      'title_url': 'title_url',
      'title_and_url': 'title_and_url',
      'markdown': 'markdown',
      'bbcode': 'bbcode',
      'csv': 'csv',
      'json': 'json',
      'html': 'html',
      'html_table': 'html_table'
    };
    
    const scope = scopeMap[selectedScope] || 'current_tab';
    const format = formatMap[selectedFormat] || selectedFormat;
    console.log(`Sending copyTabs message with scope: ${scope}, format: ${format}`);
    
    // HACK: 先发送消息到background.js准备数据，然后从本地存储读取并复制
    try {
      // 发送消息到background.js准备数据
      chrome.runtime.sendMessage({
        action: type === 'content' ? 'copyContent' : 'copyTabs',
        scope: scope,
        format: format
      }, async response => {
        console.log('Received response:', response);
        
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          showStatus(`复制失败: ${chrome.runtime.lastError.message}`, 'error');
          return;
        }
        
        if (response && response.success) {
          console.log('Background preparation successful, now trying to copy from local storage');
          
          // 从本地存储读取数据
          try {
            const result = await chrome.storage.local.get(['copiedText']);
            const textToCopy = result.copiedText;
            
            if (!textToCopy) {
              console.error('No text found in local storage');
              showStatus('未找到要复制的内容', 'error');
              return;
            }
            
            console.log('Retrieved text from local storage, length:', textToCopy.length);
            
            // 在弹出窗口中执行复制
            const copyResult = await copyTextToClipboard(textToCopy);
            
            if (copyResult) {
              console.log('Local copy successful!');
              showStatus('已复制到剪贴板！');
            } else {
              console.error('Local copy failed');
              showStatus('复制失败，请重试', 'error');
            }
          } catch (storageError) {
            console.error('Error reading from local storage:', storageError);
            showStatus(`读取存储错误: ${storageError.message}`, 'error');
          }
        } else {
          console.error('Copy preparation failed:', response);
          showStatus('复制准备失败，请重试', 'error');
        }
      });
    } catch (error) {
      console.error('Error during copy operation:', error);
      showStatus(`复制错误: ${error.message}`, 'error');
    }
  }
  
  // 将文本复制到剪贴板
  async function copyTextToClipboard(text) {
    try {
      // 尝试使用现代API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch (clipboardError) {
          console.warn('Modern clipboard API failed:', clipboardError);
          // 失败时回退到传统方法
        }
      }
      
      // 使用传统方法
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
      textarea.style.zIndex = '9999';
      
      // 添加到文档中
      document.body.appendChild(textarea);
      
      // 选中文本
      textarea.focus();
      textarea.select();
      
      // 尝试复制
      const successful = document.execCommand('copy');
      
      // 移除临时元素
      document.body.removeChild(textarea);
      
      return successful;
    } catch (error) {
      console.error('Copy to clipboard failed:', error);
      return false;
    }
  }
  
  // 显示状态消息
  function showStatus(message, type = 'success') {
    statusElement.textContent = message;
    
    // 根据类型设置样式
    if (type === 'success') {
      statusElement.style.backgroundColor = '#e6f7f2';
      statusElement.style.color = '#03a87c';
    } else if (type === 'error') {
      statusElement.style.backgroundColor = '#fbe9e7';
      statusElement.style.color = '#d32f2f';
    } else if (type === 'info') {
      statusElement.style.backgroundColor = '#e8f4fd';
      statusElement.style.color = '#0277bd';
    }
    
    statusElement.classList.add('visible');
    
    // 2秒后隐藏状态消息
    setTimeout(() => {
      statusElement.classList.remove('visible');
    }, 2000);
  }
});
