let currentChatId = null;
let isGenerating = false;
let namedChats = new Set();
let isFirstMessage = true;
let currentMessageId = null;
let currentEventSource = null;

// 初始化marked配置
marked.setOptions({
    highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
    },
    breaks: true
});

// 自动调整文本框高度
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

// 创建新对话
function newChat() {
    if (isGenerating) return;
    
    currentChatId = Date.now();
    document.getElementById('chat-messages').innerHTML = '';
    addToHistory(currentChatId, '新对话');
    isFirstMessage = true;
}

// 添加到对话历史
function addToHistory(id, title) {
    const history = document.getElementById('chat-history');
    const existingItem = document.querySelector(`.history-item[data-chat-id="${id}"]`);
    
    if (existingItem) {
        existingItem.querySelector('.history-title').textContent = title;
        return;
    }
    
    const item = document.createElement('div');
    item.className = 'history-item';
    item.setAttribute('data-chat-id', id);
    item.onclick = () => loadChat(id);
    item.innerHTML = `
        <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 mr-2" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        <span class="history-title">${title}</span>
    `;
    history.insertBefore(item, history.firstChild);
}

// 添加消息到树状结构
function addMessage(content, isUser, messageId, parentId, branchNumber, hasSiblings, depth = 0) {
    const chatMessages = document.getElementById('chat-messages');
    
    // 创建消息容器
    const messageContainer = document.createElement('div');
    messageContainer.className = 'message-tree-container';
    messageContainer.style.marginLeft = `${depth * 40}px`; // 缩进
    
    // 创建连接线
    if (depth > 0) {
        const connector = document.createElement('div');
        connector.className = 'tree-connector';
        messageContainer.appendChild(connector);
    }
    
    // 创建消息节点
    const messageNode = document.createElement('div');
    messageNode.className = `message-node ${isUser ? 'user' : 'assistant'}`;
    messageNode.setAttribute('data-message-id', messageId);
    
    // 添加头像
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.innerHTML = isUser ? 'U' : 'A';
    messageNode.appendChild(avatar);
    
    // 添加消息内容
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    if (!isUser) {
        // 处理 thinking blocks
        const processedContent = content.replace(
            /```thinking\n([\s\S]*?)```/g,
            (match, thinkingContent) => {
                return `<div class="thinking-block">
                    <div class="thinking-header">
                        <svg class="thinking-toggle" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                        </svg>
                        Claude's Thinking Process
                    </div>
                    <div class="thinking-content">
                        <pre><code class="language-plaintext">${thinkingContent}</code></pre>
                    </div>
                </div>`;
            }
        );
        messageContent.innerHTML = marked.parse(processedContent);
    } else {
        messageContent.innerHTML = marked.parse(content);
    }
    
    messageNode.appendChild(messageContent);
    
    // 添加操作按钮
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'message-buttons';
    
    // 编辑按钮
    const editButton = document.createElement('button');
    editButton.className = 'message-button edit-button';
    editButton.title = '编辑';
    editButton.innerHTML = `<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    editButton.onclick = () => editMessage(messageNode);
    buttonsContainer.appendChild(editButton);
    
    // 为 AI 消息添加复制和重试按钮
    if (!isUser) {
        const copyButton = document.createElement('button');
        copyButton.className = 'message-button copy-button';
        copyButton.innerHTML = `<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>`;
        copyButton.onclick = () => copyMessage(copyButton);
        
        const retryButton = document.createElement('button');
        retryButton.className = 'message-button retry-button';
        retryButton.innerHTML = `<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`;
        retryButton.onclick = () => retryMessage(messageNode);
        
        buttonsContainer.appendChild(copyButton);
        buttonsContainer.appendChild(retryButton);
    }
    
    // 添加分支导航按钮
    if (hasSiblings) {
        const branchNav = document.createElement('div');
        branchNav.className = 'branch-navigation';
        
        const prevButton = document.createElement('button');
        prevButton.className = 'branch-nav-button';
        prevButton.innerHTML = '←';
        prevButton.onclick = () => switchMessageBranch(messageId, 'prev');
        
        const nextButton = document.createElement('button');
        nextButton.className = 'branch-nav-button';
        nextButton.innerHTML = '→';
        nextButton.onclick = () => switchMessageBranch(messageId, 'next');
        
        branchNav.appendChild(prevButton);
        branchNav.appendChild(nextButton);
        buttonsContainer.appendChild(branchNav);
    }
    
    // 在按钮容器中添加"添加分支"按钮
    const addChildButton = document.createElement('button');
    addChildButton.className = 'message-button add-child-button';
    addChildButton.title = '添加分支';
    addChildButton.innerHTML = `<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>`;
    addChildButton.onclick = () => addChildMessage(messageNode);
    buttonsContainer.appendChild(addChildButton);
    
    messageNode.appendChild(buttonsContainer);
    messageContainer.appendChild(messageNode);
    chatMessages.appendChild(messageContainer);
    
    // 代码高亮
    messageNode.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightBlock(block);
    });
}

// 发送消息
async function sendMessage(customMessage = null, skipUserMessage = false) {
    const sendButton = document.querySelector('.send-button');
    const sendIcon = sendButton.querySelector('.send-icon');
    const stopIcon = sendButton.querySelector('.stop-icon');

    // 如果正在生成，点击则停止生成
    if (isGenerating) {
        if (currentEventSource) {
            currentEventSource.close();
            currentEventSource = null;
            isGenerating = false;
            // 恢复发送图标
            sendIcon.classList.remove('hidden');
            stopIcon.classList.add('hidden');
            
            // 不删除消息，只添加一个标记表示生成被截断
            const messageContent = document.querySelector('.message.assistant:last-child .message-content');
            if (messageContent) {
                const truncatedContent = fullResponse + '\n\n_生成已停止_';
                messageContent.innerHTML = marked.parse(truncatedContent);
                
                // 保存截断的消息到数据库
                try {
                    const response = await fetch('/save_message', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            chat_id: currentChatId,
                            role: 'assistant',
                            content: truncatedContent,
                            parent_id: currentMessageId
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error('Failed to save truncated message');
                    }
                    
                    const data = await response.json();
                    messageDiv.setAttribute('data-message-id', data.message_id);
                    
                } catch (error) {
                    console.error('Error saving truncated message:', error);
                }
                
                // 添加消息按钮（复制、重试等）
                const messageDiv = messageContent.closest('.message');
                if (messageDiv && !messageDiv.querySelector('.message-buttons')) {
                    const buttonsContainer = document.createElement('div');
                    buttonsContainer.className = 'message-buttons';
                    
                    // 添加编辑按钮
                    const editButton = document.createElement('button');
                    editButton.className = 'message-button edit-button';
                    editButton.title = '编辑';
                    editButton.innerHTML = `
                        <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>`;
                    editButton.onclick = () => editMessage(messageDiv);
                    
                    const copyButton = document.createElement('button');
                    copyButton.className = 'message-button copy-button';
                    copyButton.innerHTML = `
                        <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                        </svg>`;
                    copyButton.onclick = () => copyMessage(copyButton);
                    
                    const retryButton = document.createElement('button');
                    retryButton.className = 'message-button retry-button';
                    retryButton.innerHTML = `
                        <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                            <polyline points="1 4 1 10 7 10"></polyline>
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                        </svg>`;
                    retryButton.onclick = () => retryMessage(messageDiv);
                    
                    buttonsContainer.appendChild(editButton);
                    buttonsContainer.appendChild(copyButton);
                    buttonsContainer.appendChild(retryButton);
                    messageDiv.appendChild(buttonsContainer);
                }
            }
        }
        return;
    }
    
    // 显示停止图标
    sendIcon.classList.add('hidden');
    stopIcon.classList.remove('hidden');
    isGenerating = true;
    
    // 使用自定义消息或从输入框获取消息
    const message = customMessage || document.getElementById('user-input').value.trim();
    
    if (message === '') return;
    
    if (!currentChatId) {
        newChat();
    }
    
    // 如果是从输入框发送的消息，才清空输入框
    if (!customMessage) {
        const input = document.getElementById('user-input');
        input.value = '';
        input.style.height = 'auto';
    }
    
    // 只在非跳过的情况下显示用户消息
    if (!skipUserMessage) {
        addMessage(message, true);
    }
    
    // 创建新的消息容器用于流式响应
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.innerHTML = 'A';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    
    let fullResponse = '';
    
    try {
        // First, send the message to the server
        const response = await fetch('/send_message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                message: message,
                chat_id: currentChatId
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to send message');
        }
        
        // 创建 EventSource 并保存引用
        currentEventSource = new EventSource(`/chat_stream?chat_id=${currentChatId}`);
        
        // 处理消息块
        currentEventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.event === 'done') {
                currentEventSource.close();
                currentEventSource = null;
                isGenerating = false;
                // 恢复发送图标
                sendIcon.classList.remove('hidden');
                stopIcon.classList.add('hidden');
                
                // Name chat after first message
                if (isFirstMessage) {
                    nameChatFromFirstMessage(currentChatId, message);
                    isFirstMessage = false;
                }
                return;
            }
            
            fullResponse += data.content;
            messageContent.innerHTML = marked.parse(fullResponse);
            
            // 处理代码块，添加复制按钮
            messageContent.querySelectorAll('pre').forEach(pre => {
                // 创建包装容器
                const wrapper = document.createElement('div');
                wrapper.className = 'code-block-wrapper';
                
                // 创建复制按钮
                const copyButton = document.createElement('button');
                copyButton.className = 'code-copy-button';
                copyButton.textContent = '复制';
                copyButton.onclick = () => {
                    const code = pre.querySelector('code').textContent;
                    navigator.clipboard.writeText(code).then(() => {
                        copyButton.textContent = '已复制!';
                        setTimeout(() => {
                            copyButton.textContent = '复制';
                        }, 2000);
                    });
                };
                
                // 将代码块包装在容器中
                pre.parentNode.insertBefore(wrapper, pre);
                wrapper.appendChild(pre);
                wrapper.appendChild(copyButton);
            });
            
            // 代码高亮
            messageContent.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightBlock(block);
            });
            
            chatMessages.scrollTop = chatMessages.scrollHeight;
        };
        
        // 处理错误
        currentEventSource.onerror = (error) => {
            console.error('EventSource failed:', error);
            currentEventSource.close();
            currentEventSource = null;
            isGenerating = false;
            // 恢复发送图标
            sendIcon.classList.remove('hidden');
            stopIcon.classList.add('hidden');
            if (!fullResponse) {
                messageContent.innerHTML = marked.parse('抱歉，发生了错误，请稍后重试。');
            }
        };
        
    } catch (error) {
        console.error('Error:', error);
        messageContent.innerHTML = marked.parse('抱歉，发生了错误，请稍后重试。');
        isGenerating = false;
        currentEventSource = null;
        // 恢复发送图标
        sendIcon.classList.remove('hidden');
        stopIcon.classList.add('hidden');
    }
}

// 按回车发送消息
document.getElementById('user-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// 初始化
window.onload = async function() {
    await loadChatHistory();
    newChat();
};

// Load chat messages
async function loadChat(chatId) {
    if (isGenerating) return;
    
    try {
        const response = await fetch(`/get_chat_messages?chat_id=${chatId}`);
        if (!response.ok) {
            throw new Error('Failed to load chat');
        }
        
        const data = await response.json();
        currentChatId = chatId;
        isFirstMessage = data.messages.length === 0;
        
        // 清空当前消息
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.innerHTML = '';
        
        // 更新历史记录
        addToHistory(chatId, data.name);
        if (data.name !== '新对话') {
            namedChats.add(chatId);
        }
        
        // 显示消息树
        data.messages
            .filter(msg => msg.role !== 'system')
            .forEach(msg => {
                if (!msg.is_active) {
                    return; // 跳过非活动分支
                }
                addMessage(
                    msg.content,
                    msg.role === 'user',
                    msg.id,
                    msg.parent_id,
                    msg.branch_number,
                    msg.has_siblings,
                    msg.depth
                );
            });
            
    } catch (error) {
        console.error('Error loading chat:', error);
        alert('加载聊天记录失败');
    }
}

// Add function to request chat naming
async function nameChatFromFirstMessage(chatId, message) {
    if (namedChats.has(chatId)) return;
    
    try {
        const response = await fetch('/name_chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: chatId,
                message: message
            })
        });
        
        if (!response.ok) throw new Error('Failed to name chat');
        
        const data = await response.json();
        addToHistory(chatId, data.name);
        namedChats.add(chatId);
        
    } catch (error) {
        console.error('Error naming chat:', error);
    }
}

// Add function to load chat history
async function loadChatHistory() {
    try {
        const response = await fetch('/get_all_chats');
        if (!response.ok) throw new Error('Failed to load chat history');
        
        const chats = await response.json();
        const history = document.getElementById('chat-history');
        history.innerHTML = ''; // Clear existing history
        
        chats.forEach(chat => {
            addToHistory(chat.id, chat.name);
            if (chat.name !== '新对话') {
                namedChats.add(chat.id);
            }
        });
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

function toggleUserMenu() {
    const dropdown = document.getElementById('userMenuDropdown');
    dropdown.classList.toggle('show');
    
    // Close menu when clicking outside
    document.addEventListener('click', function closeMenu(e) {
        if (!e.target.closest('.user-menu-container')) {
            dropdown.classList.remove('show');
            document.removeEventListener('click', closeMenu);
        }
    });
}

async function clearConversations() {
    const userInput = prompt('enter passcode:');
    
    if (!userInput) {
        return; // 用户取消输入
    }
    
    try {
        const response = await fetch('/clear_conversations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                passcode: userInput
            })
        });
        
        if (!response.ok) {
            if (response.status === 403) {
                alert('口令错误，无法清除对话');
                return;
            }
            throw new Error('Failed to clear conversations');
        }
        
        if (!confirm('口令正确。确定要清除所有对话吗？')) {
            return;
        }
        
        // 清除前端显示
        document.getElementById('chat-history').innerHTML = '';
        document.getElementById('chat-messages').innerHTML = '';
        namedChats.clear();
        
        // 创建新对话
        newChat();
        
    } catch (error) {
        console.error('Error clearing conversations:', error);
        alert('清除对话失败');
    }
}

function openSettings() {
    alert('设置功能开发中...');
}

function logout() {
    alert('登出功能开发中...');
}

// 修改 retryMessage 函数
function retryMessage(messageDiv) {
    if (isGenerating) return;
    
    const messageId = messageDiv.getAttribute('data-message-id');
    
    // Find the corresponding user message
    let currentUserMessage = messageDiv.previousElementSibling;
    while (currentUserMessage && !currentUserMessage.classList.contains('user')) {
        currentUserMessage = currentUserMessage.previousElementSibling;
    }
    
    if (!currentUserMessage) {
        console.error('Could not find corresponding user message');
        return;
    }
    
    const userContent = currentUserMessage.querySelector('.message-content').textContent;
    
    // Create new branch
    fetch('/retry_message', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            chat_id: currentChatId,
            parent_id: messageId,
            message: userContent
        })
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to create new branch');
        return response.json();
    })
    .then(() => {
        // Reload chat to show new branch
        loadChat(currentChatId);
    })
    .catch(error => {
        console.error('Error:', error);
        alert('重试失败，请重新尝试');
    });
}

// Add this function to handle copying message content
function copyMessage(button) {
    const messageContent = button.closest('.message').querySelector('.message-content').textContent;
    navigator.clipboard.writeText(messageContent).then(() => {
        // Update button text temporarily
        const originalText = button.innerHTML;
        button.innerHTML = '已复制!';
        setTimeout(() => {
            button.innerHTML = originalText;
        }, 2000);
    });
}

// Add this function to escape HTML
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Add function to switch between message branches
async function switchMessageBranch(messageId, direction) {
    try {
        const response = await fetch('/switch_branch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message_id: messageId,
                direction: direction
            })
        });
        
        if (response.ok) {
            // Reload chat to show new branch
            await loadChat(currentChatId);
        }
    } catch (error) {
        console.error('Error switching branch:', error);
    }
}

// 修改 editMessage 函数
function editMessage(messageDiv) {
    const messageContent = messageDiv.querySelector('.message-content');
    // 获取原始文本内容，去除可能的 HTML 标签
    const originalContent = messageContent.textContent.trim();
    const isUser = messageDiv.classList.contains('user');
    
    // 创建编辑区域
    const editArea = document.createElement('div');
    editArea.className = 'edit-area';
    
    const textarea = document.createElement('textarea');
    textarea.value = originalContent;
    textarea.rows = 1;
    textarea.oninput = () => autoResize(textarea);
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'edit-buttons';
    
    const saveButton = document.createElement('button');
    saveButton.className = 'edit-button save';
    saveButton.textContent = '保存';
    
    const cancelButton = document.createElement('button');
    cancelButton.className = 'edit-button cancel';
    cancelButton.textContent = '取消';
    
    buttonContainer.appendChild(saveButton);
    buttonContainer.appendChild(cancelButton);
    editArea.appendChild(textarea);
    editArea.appendChild(buttonContainer);
    
    // 隐藏原内容，显示编辑区域
    messageContent.style.display = 'none';
    messageDiv.insertBefore(editArea, messageContent.nextSibling);
    
    // 自动调整度
    autoResize(textarea);
    textarea.focus();
    
    // 保存编辑
    saveButton.onclick = async () => {
        const newContent = textarea.value.trim();
        if (newContent === originalContent) {
            // 如果内容没有改变，直接取消编辑
            cancelEdit();
            return;
        }
        
        try {
            // 先保存编辑的消息
            const response = await fetch('/edit_message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chat_id: currentChatId,
                    message_id: messageDiv.getAttribute('data-message-id'),
                    content: newContent,
                    is_user: isUser
                })
            });
            
            if (!response.ok) throw new Error('Failed to save edit');
            
            // 更新显示的内容
            messageContent.innerHTML = isUser ? marked.parse(newContent) : newContent;
            cancelEdit();
            
            // 如果是用户消息，创建新的分支
            if (isUser) {
                try {
                    // 创建新的消息分支
                    const branchResponse = await fetch('/create_message_branch', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            chat_id: currentChatId,
                            parent_id: messageDiv.getAttribute('data-message-id'),
                            message: newContent
                        })
                    });
                    
                    if (!branchResponse.ok) throw new Error('Failed to create branch');
                    
                    // 使用编辑后的内容触发新的 AI 响应
                    setTimeout(() => {
                        sendMessage(newContent, true);
                    }, 100);
                    
                } catch (error) {
                    console.error('Error creating branch:', error);
                    alert('创建分支失败，请重试');
                }
            }
            
        } catch (error) {
            console.error('Error saving edit:', error);
            alert('保存失败，请重试');
        }
    };
    
    // 取消编辑
    const cancelEdit = () => {
        messageContent.style.display = '';
        editArea.remove();
    };
    
    cancelButton.onclick = cancelEdit;
    
    // 按 Esc 取消编辑
    textarea.onkeydown = (e) => {
        if (e.key === 'Escape') {
            cancelEdit();
        }
    };
}

// 添加新的函数用于创建子消息
async function addChildMessage(parentNode) {
    const parentId = parentNode.getAttribute('data-message-id');
    
    // 创建输入框
    const inputContainer = document.createElement('div');
    inputContainer.className = 'child-input-container';
    
    const textarea = document.createElement('textarea');
    textarea.className = 'child-input';
    textarea.placeholder = '输入新的分支消息...';
    textarea.rows = 1;
    textarea.oninput = () => autoResize(textarea);
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'child-input-buttons';
    
    const sendButton = document.createElement('button');
    sendButton.className = 'child-send-button';
    sendButton.textContent = '发送';
    
    const cancelButton = document.createElement('button');
    cancelButton.className = 'child-cancel-button';
    cancelButton.textContent = '取消';
    
    buttonContainer.appendChild(sendButton);
    buttonContainer.appendChild(cancelButton);
    
    inputContainer.appendChild(textarea);
    inputContainer.appendChild(buttonContainer);
    
    // 将输入框添加到父节点后面
    const parentContainer = parentNode.closest('.message-tree-container');
    parentContainer.insertAdjacentElement('afterend', inputContainer);
    
    // 自动聚焦输入框
    textarea.focus();
    
    // 处理发送
    sendButton.onclick = async () => {
        const content = textarea.value.trim();
        if (!content) return;
        
        try {
            // 创建新的消息分支
            const response = await fetch('/create_message_branch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chat_id: currentChatId,
                    parent_id: parentId,
                    message: content
                })
            });
            
            if (!response.ok) throw new Error('Failed to create branch');
            
            // 移除输入框
            inputContainer.remove();
            
            // 使用新内容触发 AI 响应
            sendMessage(content, true);
            
        } catch (error) {
            console.error('Error creating branch:', error);
            alert('创建分支失败，请重试');
        }
    };
    
    // 处理取消
    cancelButton.onclick = () => {
        inputContainer.remove();
    };
    
    // 处理按键
    textarea.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendButton.click();
        } else if (e.key === 'Escape') {
            cancelButton.click();
        }
    };
} 