Utils = {};
Utils.download = function(buffer){
    var fileMimeType = "application/zip";
    var fileName = "myfile.zip";
    var blob = new Blob(buffer, {type: fileMimeType});

    var a = document.createElement("a");
    a.style.display = "none";
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.setAttribute("type", fileMimeType)
    document.body.appendChild(a);

    var event = new MouseEvent('click', {
        'view': window,
        'bubbles': true,
        'cancelable': false
    });
    a.dispatchEvent(event);

    setTimeout(function(){
        window.URL.revokeObjectURL(a.href);
    }, 1000);
}