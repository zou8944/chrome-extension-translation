// 整一个消息缓存列表
let messageCache = [
    {
        "role": "system",
        "content": "You are ChatGPT, a large language model trained by OpenAI. Answer as concisely as possible. Knowledge cutoff: {knowledge_cutoff} Current date: {current_date}"
    },
]
let isDragging = false;
let offset = {x: 0, y: 0};
let isDialogShow = false
let openaiKey = ""

// 接收来自 service-worker 的消息，渲染弹出框
chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
    if (request.action === "translate-selected") {
        openaiKey = (await chrome.storage.sync.get(["openaiKey"])).openaiKey
        // get current selection text and it's parent node
        await translateSelectedText()
    }
    sendResponse("translated")
});

async function translateSelectedText() {
    let selectedText = getSelectedText()
    let promptText = `请问在下列语句中，单词 ${selectedText.text} 的意思是？\n${selectedText.parent}`
    // 添加对话框组件
    await addChatDialogElement()
    // 重置对话框位置
    await resetDialogPosition()
    // 重置对话框的各种事件
    await resetDialogAction()
    // 添加初始消息
    await addMessage(true, promptText)
}

function getSelectedText() {
    function getBlockParent(node) {
        if (node === null) {
            return null;
        }
        if (node.nodeType === 1 && node.nodeName !== 'BODY') {
            let style = window.getComputedStyle(node);
            if (style.display === 'block') {
                return node;
            } else {
                return getBlockParent(node.parentNode);
            }
        } else {
            return getBlockParent(node.parentNode);
        }
    }

    // 当前选中的文本
    let selection = window.getSelection();
    let selectionText = selection.toString();
    // 当前选中文本的第一个块类型父元素
    let selectionParent = getBlockParent(selection.anchorNode)
    let selectionParentText = selectionParent.innerText

    return {
        text: selectionText,
        parent: selectionParentText
    }
}

async function addChatDialogElement() {
    if (isDialogShow) {
        await removeChatDialogElement()
        messageCache.splice(0, messageCache.length)
        isDialogShow = false
    }
    isDialogShow = true
    let cssURL = chrome.runtime.getURL("translation/dialog.css")
    let htmlURL = chrome.runtime.getURL("translation/dialog.html")

    let html = await fetch(htmlURL)

    let link = document.createElement("link")
    link.rel = "stylesheet"
    link.type = "text/css"
    link.href = cssURL

    let htmlParser = new DOMParser()
    let htmlDoc = htmlParser.parseFromString(await html.text(), "text/html")
    let dialogContainer = htmlDoc.getElementById("dialog-container")

    document.getElementsByTagName('head')[0].appendChild(link)
    document.body.appendChild(dialogContainer)
}

async function removeChatDialogElement() {
    isDialogShow = false
    let cssURL = chrome.runtime.getURL("translation/dialog.css")

    let link = document.querySelector(`link[href="${cssURL}"]`)

    if (link) {
        link.remove()
    }

    let dialogContainer = document.getElementById("dialog-container")
    if (dialogContainer) {
        dialogContainer.remove()
    }
}

async function resetDialogPosition() {
    let selection = window.getSelection();
    let range = selection.getRangeAt(0)
    let rect = range.getBoundingClientRect()
    let bodyRect = document.body.getBoundingClientRect()
    let dialog = getElementInDialog("dialog-container")
    if (dialog && rect) {
        dialog.style.left = rect.left + rect.width - bodyRect.left + 10 + "px"
        dialog.style.top = rect.top + rect.height - bodyRect.top + 10 + "px"
    }
}

async function resetDialogAction() {
    let dialogContainer = getElementInDialog("dialog-container")
    let dialogHeader = getElementInDialog("dialog-header")
    let closeButton = getElementInDialog("close-btn")
    let sendButton = getElementInDialog("send-btn")
    let inputText = getElementInDialog("input-text")
    // 点击关闭按钮时退出并清理消息缓存
    closeButton.onclick = (e) => {
        removeChatDialogElement()
        messageCache.splice(0, messageCache.length)
    }
    // 点击发送按钮时添加消息到对话框
    sendButton.onclick = (e) => {
        if (inputText.value.trim()) {
            addMessage(true, inputText.value)
            inputText.value = '';
        }
    }
    // 输入框按下回车时触发发送按钮的点击事件
    inputText.onkeydown = (e) => {
        if (e.key === 'Enter') {
            sendButton.click();
        }
    }
    // 鼠标按下时开始拖动
    dialogHeader.onmousedown = (e) => {
        isDragging = true
        offset.x = e.clientX - dialogContainer.offsetLeft;
        offset.y = e.clientY - dialogContainer.offsetTop;
    }
    // 鼠标松开时停止拖动
    dialogHeader.onmouseup = (e) => {
        isDragging = false
    }
    // 鼠标移动时，更新容器位置
    dialogHeader.onmousemove = (e) => {
        if (isDragging) {
            dialogContainer.style.left = (e.clientX - offset.x) + 'px';
            dialogContainer.style.top = (e.clientY - offset.y) + 'px';
        }
    }
}

// 添加消息到对话框
async function addMessage(isSelf, message) {
    // 创建如下结构的元素
    // <div className="message">
    //     <div className="other">你好</div>
    // </div>
    let messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    let messageContent = document.createElement('div');
    messageContent.innerHTML = message
    messageDiv.appendChild(messageContent);
    if (isSelf) {
        messageContent.classList.add('self');
    } else {
        messageContent.classList.add('other');
    }

    let dialogContent = getElementInDialog("dialog-content")
    dialogContent.appendChild(messageDiv);
    dialogContent.scrollTop = dialogContent.scrollHeight;
    if (isSelf) {
        // 如果是我们自己发送的消息，还要异步调用chat接口获得机器人消息
        if (openaiKey) {
            await askChatGPT(message)
        } else {
            await addMessage(false, "您还没有设置OpenAI的API Key，请点击插件图标进行设置")
        }
    }
}

async function askChatGPT(message) {
    messageCache.push({
        "role": "user",
        "content": message
    })
    let chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
            "model": "gpt-3.5-turbo",
            "messages": messageCache,
        })
    })
    let chatResult = await chatResponse.json()
    console.log(chatResult)
    messageCache.push(chatResult.choices[0].message)
    await addMessage(false, chatResult.choices[0].message.content)
}

function getElementInDialog(id) {
    let dialogContainer = document.getElementById("dialog-container")
    if (id === "dialog-container") {
        return dialogContainer
    }
    return dialogContainer.querySelector(`#${id}`)
}

console.log("content script loaded")

