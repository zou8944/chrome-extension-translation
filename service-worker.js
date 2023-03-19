chrome.contextMenus.create({
    id: 'translate',
    title: '翻译',
    contexts: ['selection']
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId === 'translate') {
        const data = {
            selectionText: info.selectionText
        }
        console.log(data)
        chrome.runtime.sendMessage({data: data}, function (response) {
            console.log(response);
        })
    }
})
