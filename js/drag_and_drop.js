function DragAndDrop(nodeId){
    var that = this;
    var node = document.getElementById(nodeId);
    var className = "ondragover";
    var isOver = false;
    var fileInput;
    node.ondragover = function(e){
        e.preventDefault();
        if(!isOver){
            isOver = true;
            node.classList.add(className);
        }
        return false;
    }
    node.ondragleave = function(){
        if(isOver){
            isOver = false;
            node.classList.remove(className);
        }
    }
    node.ondrop = function(e){
        var file;
        e.preventDefault();
        node.ondragleave();
        if(typeof that.ondropped == "function"){
            file = new Zip();
            file.init(e.dataTransfer)
                .then(function(){
                    that.ondropped(file);
                });
        }
        return false;
    }
    
    // Click to open file browser
    fileInput = document.createElement("input");
    fileInput.setAttribute("multiple", "true");
    fileInput.type = "file";
    fileInput.style.visibility = "hidden";
    fileInput.style.position = "absolute";
    fileInput.onchange = function(e){
        e.dataTransfer = {files : this.files};
        node.ondrop(e);
    }
    node.appendChild(fileInput);
    node.onclick = function(){
        fileInput.click();
    }
}
