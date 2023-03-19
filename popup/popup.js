async function editButtonClicked() {
    let textInput = document.getElementById('textInput');
    let editButton = document.getElementById('editButton');

    if (textInput.disabled) {
        textInput.disabled = false;
        textInput.focus();
        editButton.innerHTML = '保存';
    } else {
        textInput.disabled = true;
        editButton.innerHTML = '编辑';
        await chrome.storage.sync.set({openaiKey: textInput.value.trim()});
    }
}

// 为editButton添加点击事件
document.getElementById("editButton").onclick = editButtonClicked;