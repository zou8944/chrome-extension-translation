// add translation context menu
chrome.contextMenus.create({
    id: 'translation',
    title: '翻译',
    contexts: ['selection']
});

// add listener for context menu click
chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId === 'translation') {
        // 通知 content script 翻译选中的文本
        chrome.tabs.sendMessage(tab.id, {action: "translate-selected",}).then((response) => {
            console.log(response)
        });
    }
})
