/**
 * EasyCopy - Chrome Extension
 * Background script to handle copying and visual feedback
 */

// 复制格式选项
const COPY_FORMATS = {
  URL: 'url',
  TITLE_URL: 'title_url',
  TITLE_AND_URL: 'title_and_url',
  TITLE: 'title',
  MARKDOWN: 'markdown',
  BBCODE: 'bbcode',
  CSV: 'csv',
  JSON: 'json',
  HTML: 'html',
  HTML_TABLE: 'html_table'
};

// 复制范围选项
const COPY_SCOPES = {
  THIS_TAB: 'this_tab',
  WINDOW_TABS: 'window_tabs',
  ALL_TABS: 'all_tabs',
  ALL_TABS_BY_WINDOW: 'all_tabs_by_window'
};

/**
 * Copy the current tab's title and URL to clipboard
 * using the Clipboard API via a content script
 */
async function copyTitleAndUrl(tabId) {
  try {
    // Get the current active tab info
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      return false;
    }
    
    const currentTab = tabs[0];
    const textToCopy = `${currentTab.title}\n${currentTab.url}`;
    
    // Execute a content script to copy the text
    // This is more reliable than using clipboard in background context
    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: text => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
      },
      args: [textToCopy]
    });
    
    // Show success feedback with a green badge with checkmark
    await showBadge('✓', '#4CAF50');
    
    return true;
  } catch (error) {
    console.error('Copy failed:', error);
    
    // Show error feedback with a red badge with X
    await showBadge('✗', '#F44336');
    
    return false;
  }
}

/**
 * Copy the current webpage's core content using Readability
 * @param {number} tabId - The ID of the current tab
 */
async function copyReadableContent(tabId) {
  try {
    // Execute the Readability script first
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['Readability.js']
    });
    
    // Then execute our content script to extract and copy the content
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-script.js']
    });
    
    return true;
  } catch (error) {
    console.error('Failed to copy readable content:', error);
    await showBadge('✗', '#F44336');
    return false;
  }
}

/**
 * 格式化标签页数据为指定格式
 * @param {Array|Object} tabs - 标签页数据，可以是单个标签页对象或标签页数组
 * @param {string} format - 输出格式
 * @returns {string} 格式化后的文本
 */
function formatTabs(tabs, format) {
  // 确保tabs是数组
  const tabsArray = Array.isArray(tabs) ? tabs : [tabs];
  
  switch (format) {
    case COPY_FORMATS.URL:
      return tabsArray.map(tab => tab.url).join('\n');
      
    case COPY_FORMATS.TITLE:
      return tabsArray.map(tab => tab.title).join('\n');
      
    case COPY_FORMATS.TITLE_URL:
      return tabsArray.map(tab => `${tab.title}: ${tab.url}`).join('\n');
      
    case COPY_FORMATS.TITLE_AND_URL:
      return tabsArray.map(tab => `${tab.title}\n${tab.url}`).join('\n\n');
      
    case COPY_FORMATS.MARKDOWN:
      return tabsArray.map(tab => `[${tab.title}](${tab.url})`).join('\n');
      
    case COPY_FORMATS.BBCODE:
      return tabsArray.map(tab => `[url=${tab.url}]${tab.title}[/url]`).join('\n');
      
    case COPY_FORMATS.CSV:
      return 'Title,URL\n' + 
        tabsArray.map(tab => `"${tab.title.replace(/"/g, '""')}","${tab.url}"`).join('\n');
      
    case COPY_FORMATS.JSON:
      return JSON.stringify(tabsArray.map(tab => ({ title: tab.title, url: tab.url })), null, 2);
      
    case COPY_FORMATS.HTML:
      return tabsArray.map(tab => `<a href="${tab.url}">${escapeHtml(tab.title)}</a>`).join('<br>\n');
      
    case COPY_FORMATS.HTML_TABLE:
      return `<table>\n  <thead>\n    <tr>\n      <th>Title</th>\n      <th>URL</th>\n    </tr>\n  </thead>\n  <tbody>\n${tabsArray.map(tab => 
        `    <tr>\n      <td>${escapeHtml(tab.title)}</td>\n      <td><a href="${tab.url}">${tab.url}</a></td>\n    </tr>`
      ).join('\n')}\n  </tbody>\n</table>`;
      
    default:
      return tabsArray.map(tab => `${tab.title}\n${tab.url}`).join('\n\n');
  }
}

/**
 * HTML转义函数
 * @param {string} text - 需要转义的文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * 获取标签页并复制到剪贴板
 * @param {string} scope - 复制范围
 * @param {string} format - 复制格式
 */
async function copyTabs(scope, format) {
  try {
    let tabsToCopy = [];
    
    switch (scope) {
      case COPY_SCOPES.THIS_TAB:
        const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (currentTabs.length > 0) {
          tabsToCopy = [currentTabs[0]];
        }
        break;
        
      case COPY_SCOPES.WINDOW_TABS:
        tabsToCopy = await chrome.tabs.query({ currentWindow: true });
        break;
        
      case COPY_SCOPES.ALL_TABS:
        tabsToCopy = await chrome.tabs.query({});
        break;
        
      case COPY_SCOPES.ALL_TABS_BY_WINDOW:
        const windows = await chrome.windows.getAll();
        const allTabsByWindow = [];
        
        for (const window of windows) {
          const windowTabs = await chrome.tabs.query({ windowId: window.id });
          if (windowTabs.length > 0) {
            // 添加窗口分隔符
            if (allTabsByWindow.length > 0) {
              allTabsByWindow.push({ title: '------- Window ' + window.id + ' -------', url: '' });
            }
            allTabsByWindow.push(...windowTabs);
          }
        }
        
        tabsToCopy = allTabsByWindow;
        break;
    }
    
    if (tabsToCopy.length === 0) {
      throw new Error('No tabs found to copy');
    }
    
    const textToCopy = formatTabs(tabsToCopy, format);
    
    // HACK: 将要复制的内容存入本地存储，以便弹出窗口可以访问
    try {
      await chrome.storage.local.set({ 'copiedText': textToCopy });
      console.log('Text saved to local storage for popup access');
      
      // 尝试使用内容脚本复制
      const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTabs || activeTabs.length === 0) {
        console.log('No active tab found, will rely on popup to copy');
        return true; // 返回成功，由弹出窗口处理复制
      }
      
      // 执行内容脚本复制文本
      await chrome.scripting.executeScript({
        target: { tabId: activeTabs[0].id },
        func: text => {
          try {
            // 创建一个临时的textarea元素
            const textArea = document.createElement('textarea');
            textArea.value = text;
            
            // 设置样式使其不可见但能获得焦点
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            textArea.style.left = '0';
            textArea.style.top = '0';
            textArea.style.width = '1px';
            textArea.style.height = '1px';
            textArea.style.padding = '0';
            textArea.style.border = 'none';
            textArea.style.outline = 'none';
            textArea.style.boxShadow = 'none';
            textArea.style.background = 'transparent';
            textArea.style.zIndex = '9999';
            
            // 添加到文档中
            document.body.appendChild(textArea);
            
            // 选中文本
            textArea.focus();
            textArea.select();
            
            // 尝试复制
            const successful = document.execCommand('copy');
            
            // 移除临时元素
            document.body.removeChild(textArea);
            
            console.log('Copy operation result:', successful ? 'success' : 'failed');
            return successful;
          } catch (error) {
            console.error('Error during copy operation:', error);
            return false;
          }
        },
        args: [textToCopy]
      }).then(results => {
        // 检查复制结果
        const copySuccessful = results && results[0] && results[0].result === true;
        console.log('Copy script execution result:', copySuccessful ? 'success' : 'failed');
        
        if (!copySuccessful) {
          console.warn('Copy operation failed in content script, will rely on popup');
        }
      }).catch(error => {
        console.error('Error executing copy script:', error);
      });
      
      // 无论内容脚本是否成功，都返回成功，因为我们已经将内容存入了本地存储
      return true;
    } catch (storageError) {
      console.error('Failed to save to local storage:', storageError);
      throw storageError;
    }
    
    // 显示成功反馈
    await showBadge('✓', '#4CAF50');
    
    return true;
  } catch (error) {
    console.error('Copy failed:', error);
    
    // 显示错误反馈
    await showBadge('✗', '#F44336');
    
    return false;
  }
}

/**
 * Show a badge on the extension icon with the specified text and color
 * @param {string} text - The text to display on the badge
 * @param {string} color - The background color of the badge
 */
async function showBadge(text, color) {
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
  
  // Reset badge after 2 seconds
  setTimeout(async () => {
    await chrome.action.setBadgeText({ text: '' });
  }, 2000);
}

// 添加点击跟踪变量
let clickCount = 0;
let lastClickTime = 0;
const clickThreshold = 500; // 点击间隔阈值（毫秒）

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  
  if (message.action === 'copySuccess') {
    showBadge('✓', '#4CAF50');
    sendResponse({ success: true });
  } else if (message.action === 'copyError') {
    console.error('Copy error:', message.error);
    showBadge('✗', '#F44336');
    sendResponse({ success: false });
  } else if (message.action === 'copyTabs') {
    // Handle request from popup.js or advanced-popup.js
    console.log('Copying tabs with scope:', message.scope, 'and format:', message.format);
    
    // 立即响应，避免连接关闭
    copyTabs(message.scope, message.format)
      .then(success => {
        console.log('Copy result:', success ? 'success' : 'failed');
        // 直接发送响应
        sendResponse({ success: success });
      })
      .catch(error => {
        console.error('Error copying tabs:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep the message channel open for async response
  }
  
  return true; // 保持消息通道开放
});

// Create context menu item when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  // 创建复制范围菜单
  chrome.contextMenus.create({
    id: 'copy',
    title: 'COPY',
    contexts: ['action']
  });
  
  // 添加复制范围子菜单
  chrome.contextMenus.create({
    id: COPY_SCOPES.THIS_TAB,
    parentId: 'copy',
    title: 'This tab',
    contexts: ['action']
  });
  
  chrome.contextMenus.create({
    id: COPY_SCOPES.WINDOW_TABS,
    parentId: 'copy',
    title: "This window's tabs",
    contexts: ['action']
  });
  
  chrome.contextMenus.create({
    id: COPY_SCOPES.ALL_TABS,
    parentId: 'copy',
    title: 'All tabs',
    contexts: ['action']
  });
  
  chrome.contextMenus.create({
    id: COPY_SCOPES.ALL_TABS_BY_WINDOW,
    parentId: 'copy',
    title: 'All tabs by window',
    contexts: ['action']
  });
  
  // 添加分隔符
  chrome.contextMenus.create({
    id: 'separator1',
    parentId: 'copy',
    type: 'separator',
    contexts: ['action']
  });
  
  // 添加复制格式标题
  chrome.contextMenus.create({
    id: 'copy_as',
    parentId: 'copy',
    title: 'Copy as:',
    contexts: ['action'],
    enabled: false
  });
  
  // 添加复制格式子菜单
  chrome.contextMenus.create({
    id: COPY_FORMATS.URL,
    parentId: 'copy',
    title: 'URL',
    contexts: ['action']
  });
  
  chrome.contextMenus.create({
    id: COPY_FORMATS.TITLE_URL,
    parentId: 'copy',
    title: 'Title: URL',
    contexts: ['action']
  });
  
  chrome.contextMenus.create({
    id: COPY_FORMATS.TITLE_AND_URL,
    parentId: 'copy',
    title: 'Title & URL',
    contexts: ['action']
  });
  
  chrome.contextMenus.create({
    id: COPY_FORMATS.TITLE,
    parentId: 'copy',
    title: 'Title',
    contexts: ['action']
  });
  
  chrome.contextMenus.create({
    id: COPY_FORMATS.MARKDOWN,
    parentId: 'copy',
    title: 'Markdown',
    contexts: ['action']
  });
  
  chrome.contextMenus.create({
    id: COPY_FORMATS.BBCODE,
    parentId: 'copy',
    title: 'BBCode',
    contexts: ['action']
  });
  
  chrome.contextMenus.create({
    id: COPY_FORMATS.CSV,
    parentId: 'copy',
    title: 'CSV',
    contexts: ['action']
  });
  
  chrome.contextMenus.create({
    id: COPY_FORMATS.JSON,
    parentId: 'copy',
    title: 'JSON',
    contexts: ['action']
  });
  
  chrome.contextMenus.create({
    id: COPY_FORMATS.HTML,
    parentId: 'copy',
    title: 'HTML',
    contexts: ['action']
  });
  
  chrome.contextMenus.create({
    id: COPY_FORMATS.HTML_TABLE,
    parentId: 'copy',
    title: 'HTML table',
    contexts: ['action']
  });
  
  // 创建网页右键菜单项
  chrome.contextMenus.create({
    id: 'copyReadableContent',
    title: '用EasyCopy复制网页内容',
    contexts: ['page', 'selection', 'link']
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'copyReadableContent') {
    copyReadableContent(tab.id);
    return;
  }
  
  // 处理复制范围菜单点击
  if (Object.values(COPY_SCOPES).includes(info.menuItemId)) {
    copyTabs(info.menuItemId, COPY_FORMATS.TITLE_AND_URL); // 默认使用标题和URL格式
    return;
  }
  
  // 处理复制格式菜单点击
  if (Object.values(COPY_FORMATS).includes(info.menuItemId)) {
    copyTabs(COPY_SCOPES.THIS_TAB, info.menuItemId); // 默认复制当前标签页
    return;
  }
});

// 使用上面已声明的点击跟踪变量

// 添加三击处理函数
function handleTripleClick() {
  console.log('Triple click detected - showing advanced popup');
  
  // 创建并显示高级弹出窗口
  chrome.windows.create({
    url: chrome.runtime.getURL('advanced-popup.html'),
    type: 'popup',
    width: 320,
    height: 380,
    left: 1000, // 固定位置 - 距离屏幕左侧 1000 像素
    top: 80,    // 固定位置 - 距离屏幕顶部 80 像素
    focused: true
  });
}

// Listen for extension icon clicks (enhanced functionality)
chrome.action.onClicked.addListener(async (tab) => {
  const currentTime = new Date().getTime();
  const timeSinceLastClick = currentTime - lastClickTime;
  
  // 如果点击间隔小于阈值，增加点击计数
  if (timeSinceLastClick < clickThreshold) {
    clickCount++;
    console.log(`Click count increased to: ${clickCount}`);
  } else {
    // 如果间隔过长，重置计数为1（当前点击）
    clickCount = 1;
    console.log('Click count reset to 1 (timeout)');
  }
  
  // 更新最后点击时间
  lastClickTime = currentTime;
  
  // 根据点击次数执行不同操作
  if (clickCount === 1) {
    // 单击操作 - 复制标题和URL（原有功能）
    console.log('Single click detected - copying title and URL');
    await copyTitleAndUrl(tab.id);
  } else if (clickCount === 2) {
    // 双击操作 - 复制可读内容
    console.log('Double click detected - copying readable content');
    await copyReadableContent(tab.id);
  } else if (clickCount >= 3) {
    // 三击操作 - 显示高级弹出窗口
    handleTripleClick();
    // 重置点击计数
    clickCount = 0;
  }
  
  // 设置一个定时器，在一段时间后自动重置点击计数
  // 这样可以避免用户意外触发多击事件
  setTimeout(() => {
    if (clickCount > 0) {
      clickCount = 0;
    }
  }, 1000);
});
