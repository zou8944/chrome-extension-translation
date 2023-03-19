chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.log(request);
    sendResponse("我收到了你的消息！");
})