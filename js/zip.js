function Zip(){
    var that = this;
    var fileInfos = [];
    var centralDirectoryArray, endOfCentralDirectoryArray;
    
    this.isZip = true;
    this.size = 0;
    this.name = "takeafile.zip";
    this.type = "application/zip, application/octet-stream";
    
    function FileInfo(file, path){
        if(path.charAt(0) === '/'){
            path = path.substr(1);
        }
        var nameUint8Array = new TextEncoder("utf-8").encode(path/*file.name*/);
        var contentByteLength = file.size;
        function getLastModificationTime(){
            var date = file.lastModifiedDate;
            var h = date.getHours();
            var m = date.getMinutes();
            var s = date.getSeconds() >> 1; // Seconds / 2
            var ret = 0;
            ret = ret | h;
            ret = ret << 6;
            ret = ret | m;
            ret = ret << 5;
            ret = ret | s;
            return ret;
        }
        function getLastModificationDate(){
            var date = file.lastModifiedDate;
            var y = date.getFullYear() - 1980;
            var m = date.getMonth() + 1;
            var d = date.getDate();
            var ret = 0;
            ret = ret | y;
            ret = ret << 4;
            ret = ret | m;
            ret = ret << 5;
            ret = ret | d;
            return ret;
        }
        var lastModificationTime = getLastModificationTime();
        var lastModificationDate = getLastModificationDate();
        var headerArray = createFileHeader(nameUint8Array, lastModificationTime, lastModificationDate);
        var crc32 = 0;
        this.getLastModificationTime = function(){
            return lastModificationTime;
        }
        this.getLastModificationDate = function(){
            return lastModificationDate;
        }
        this.getNameByteLength = function(){
            return nameUint8Array.byteLength;
        }
        this.getNameByteArray = function(index){
            if(typeof index != "undefined"){
                return nameUint8Array[index];
            }else{
                return nameUint8Array;
            }
        }
        this.getContentByteLength = function(){
            return contentByteLength;
        }
        
        this.setCrc32 = function(_crc32){
            crc32 = _crc32;
        }
        this.getCrc32 = function(){
            return crc32;
        }
        function createDataDescriptor(crc32, contentByteLength){
            var data = new MyUint8Array(16);
            // Optional data descriptor signature = 0x08074b50
            data.push([0x50, 0x4b, 0x07, 0x08]);
            // CRC-32
            pushNumber(data, crc32, 4);
            // Compressed size
            pushNumber(data, contentByteLength, 4);
            // Uncompressed size
            pushNumber(data, contentByteLength, 4);
            return data;
        }
        var footerArray = createDataDescriptor(crc32, nameUint8Array.byteLength);
        this.getHeader = function(){
            return headerArray.array;
        }
        this.getFooter = function(){
            return footerArray.array;
        }
        var reader = new FileReader();
        var previousEndByte = 0;
        var CRC32Calculator = new CRC32();
        this.read = function(startByte, endByte, listener){
            //return new Promise(function(resolve, reject){
                var slice = file.slice(startByte, endByte);
                reader.onloadend = function(e){
                    if(e.target.readyState == FileReader.DONE){
                        var result = e.target.result;
                        var bytesRead = listener(e);
                        if(crc32 == 0){
                            if(startByte != previousEndByte){
                                // TODO: CRC calculation is invalid, reprocess from file
                                // alternative: wait till arrival to unread positions
                                console.error("CRC calculation is invalid", startByte, previousEndByte);
                            }else{
                                //console.log("CRC calculation is fine", startByte, previousEndByte);
                            }
                            previousEndByte += bytesRead;
                            CRC32Calculator.add(new Uint8Array(result, 0, bytesRead));
                            if(previousEndByte == contentByteLength){
                                crc32 = CRC32Calculator.end();
                                footerArray = createDataDescriptor(crc32, nameUint8Array.byteLength);
                                // Actually, this is only needed when the last file finishes
                                centralDirectoryArray = createCentralDirectoryFileHeader(fileInfos);
                            }
                        }
                        //resolve(e.target.result);
                    }
                }
                reader.readAsArrayBuffer(slice);
            //});
        };
    }
    
    function traverseFileTree(item){
        return new Promise(function(resolve, reject){
            var reader;
            if(!item){resolve();return;}
            if(item.isFile){
                item.file(function(file){
                    fileInfos.push(new FileInfo(file, item.fullPath));
                    resolve();
                }, function(error){
                    console.log(error);
                })
            }else if(item.isDirectory){
                reader = item.createReader();
                reader.readEntries(function(entries){
                    var i, promises = [];
                    for(i = 0; i < entries.length; ++i){
                        promises.push(traverseFileTree(entries[i]));
                    }
                    Promise.all(promises).then(resolve);
                });
            }else{
                resolve();
            }
        });
    }
    function calculateZipSize(){
        var i, size = 0;
        for(i = 0; i < fileInfos.length; ++i){
            size += fileInfos[i].getHeader().byteLength;
            size += fileInfos[i].getContentByteLength();
            size += fileInfos[i].getFooter().byteLength;
        }
        size += centralDirectoryArray.byteLength;
        size += endOfCentralDirectoryArray.byteLength;
        return size;
    }
    this.init = function(dataTransfer){
        var i, promises = [], item, items = dataTransfer.items;
        if(typeof items != "undefined"){
            if(items.length == 1){
                item = items[0].webkitGetAsEntry();
                this.name = item.name+".zip";
            }
            for(i = 0; i < items.length; ++i){
                item = items[i].webkitGetAsEntry();
                promises.push(traverseFileTree(item));
            }
        }else{ // Multi-file selection
            for(i = 0; i < dataTransfer.files.length; ++i){
                fileInfos.push(new FileInfo(dataTransfer.files[i], dataTransfer.files[i].name));
            }
        }
        
        return new Promise(function(resolve, reject){
            Promise.all(promises).then(function(){
                centralDirectoryArray = createCentralDirectoryFileHeader(fileInfos);
                endOfCentralDirectoryArray = createEndOfCentralDirectoryRecord(fileInfos);
                that.size = calculateZipSize();
                resolve();
            });
        });
    }
    this.print = function(){
        var i;
        for(i = 0; i < files.length; ++i){
            console.log(files[i]);
        }
    }
    function MyUint8Array(size){
        this.array = new Uint8Array(size);
        var index = 0;
        this.push = function(value){
            var i;
            if(typeof value.length != "undefined"){
                for(i = 0; i < value.length; ++i){
                    this.array[index++] = value[i];
                }
            }else{
                this.array[index++] = value;
            }
        }
        this.byteLength = this.array.byteLength;
    }
    function pushNumber(data, number, size){
        var i, buf = new ArrayBuffer(size);
        var bufView;
        // TODO: Little / big endian
        if(size == 4){
            bufView = new Uint32Array(buf);
        }else if(size == 2){
            bufView = new Uint16Array(buf);
        }
        var bufView2 = new Uint8Array(buf);
        bufView[0] = number;
        for(i = 0; i < size; ++i){
            data.push(bufView2[i]);
        }
    }
    function createFileHeader(uint8ArrayName, lastModificationTime, lastModificationDate){
        var data = new MyUint8Array(30 + uint8ArrayName.byteLength);
        // Local file header signature = 0x04034b50 (read as a little-endian number)
        data.push([0x50, 0x4b, 0x03, 0x04]);
        // Version needed to extract (minimum)
        data.push([0x0a, 0x00]); // 2d 4.5, ZIP64 (>4GB)
        // General purpose bit flag
        data.push([0x08, 0x08]); // data descriptor at the end of data and UTF8 file names
        // Compression method
        data.push([0x00, 0x00]);
        // File last modification time
        pushNumber(data, lastModificationTime, 2);
        //data.push([0x00, 0x00]);
        // File last modification date
        pushNumber(data, lastModificationDate, 2);
        //data.push([0x00, 0x00]);
        // CRC-32
        data.push([0x00, 0x00, 0x00, 0x00]);
        // Compressed size
        data.push([0x00, 0x00, 0x00, 0x00]);
        // Uncompressed size
        data.push([0x00, 0x00, 0x00, 0x00]);
        // File name length (n)
        pushNumber(data, uint8ArrayName.byteLength , 2);
        // Extra field length (m)
        data.push([0x00, 0x00]);
        // File name
        for(var y = 0; y < uint8ArrayName.byteLength ; ++y){
            data.push(uint8ArrayName[y]);
        }
        // Extra field
        
        return data;
    }
    
    function createCentralDirectoryFileHeader(fileInfos){
        var i, j, size = 0, offset = 0;
        for(i = 0; i < fileInfos.length; ++i){
            size += 46 + fileInfos[i].getNameByteLength();
        }
        var data = new MyUint8Array(size);
        for(i = 0; i < fileInfos.length; ++i){
            // Central directory file header signature = 0x02014b50
            data.push([0x50, 0x4b, 0x01, 0x02]);
            // Version made by
            data.push([0x1e, 0x00]); //0x03 = UNIX system, do we need this?
            // Version needed to extract (minimum)
            data.push([0x0a, 0x00]);
            // General purpose bit flag
            data.push([0x08, 0x08]);
            // Compression method
            data.push([0x00, 0x00]);
            // File last modification time
            pushNumber(data, fileInfos[i].getLastModificationTime(), 2);
            //data.push([0x00, 0x00]);
            // File last modification date
            pushNumber(data, fileInfos[i].getLastModificationDate(), 2);
            //data.push([0x00, 0x00]);
            // CRC-32
            pushNumber(data, fileInfos[i].getCrc32(), 4);
            // Compressed size
            pushNumber(data, fileInfos[i].getContentByteLength(), 4);
            // Uncompressed size
            pushNumber(data, fileInfos[i].getContentByteLength(), 4);
            // File name length (n)
            pushNumber(data, fileInfos[i].getNameByteLength(), 2);
            // Extra field length (m)
            data.push([0x00, 0x00]);
            // File comment length (k)
            data.push([0x00, 0x00]);
            // Disk number where file starts
            data.push([0x00, 0x00]);
            // Internal file attributes
            data.push([0x00, 0x00]);
            // External file attributes
            data.push([0x00, 0x00, 0x00, 0x00]);
            // Relative offset of local file header
            pushNumber(data, offset, 4);
            offset += 30 + 16 + fileInfos[i].getNameByteLength() + fileInfos[i].getContentByteLength();
            // File name (size n)
            for(j = 0; j < fileInfos[i].getNameByteLength(); ++j){
                data.push(fileInfos[i].getNameByteArray(j));
            }
        }
        return data.array;
    }
    function createEndOfCentralDirectoryRecord(fileInfos){
        var data = new MyUint8Array(22);
        // End of central directory signature = 0x06054b50
        data.push([0x50, 0x4b, 0x05, 0x06]);
        // Number of this disk
        data.push([0x00, 0x00]);
        // Disk where central directory starts
        data.push([0x00, 0x00]);
        // Number of central directory records on this disk
        data.push([0x01, 0x00]);
        // Total number of central directory records
        pushNumber(data, fileInfos.length, 2);
        // Size of central directory (bytes)
        var i, centralDirectorySize = 0, centralDirectoryOffset = 0;
        for(i = 0; i < fileInfos.length; ++i){
            centralDirectorySize += 46 + fileInfos[i].getNameByteLength();
            centralDirectoryOffset += 30 + 16 + fileInfos[i].getNameByteLength() + fileInfos[i].getContentByteLength();
        }
        pushNumber(data, centralDirectorySize, 4);
        // Offset of start of central directory, relative to start of archive
        pushNumber(data, centralDirectoryOffset, 4);
        // Comment length (n)
        data.push([0x00, 0x00]);
        // Comment
        return data.array;
    }
    
    ////////////////////
    this.read = function(startByte, endByte, listener){
        //return new Promise(function(resolve, reject){
            
            // Assume there are no fast forward to previously unread regions
            var i, result, size = 0;
            for(i = 0; i < fileInfos.length; ++i){
                size += fileInfos[i].getHeader().byteLength;
                if(size > startByte){
                    setTimeout(function(){
                        result = fileInfos[i].getHeader().slice(-(size - startByte));
                        listener({target : {result : result, readyState : FileReader.DONE}});
                    }, 0);
                    return;
                }
                
                if(size + fileInfos[i].getContentByteLength() > startByte){
                    fileInfos[i].read(startByte - size, endByte - size, listener);
                    return;
                }
                size += fileInfos[i].getContentByteLength();
                
                size += fileInfos[i].getFooter().byteLength;
                if(size > startByte){
                    // Rationale: After reading the end of a file, FileTransfer will try to read the footer
                    // before FileInfo.read() is completed and the CRC32 is calculated. If we postpone
                    // the footer reading, FileInfo.read() will complete and when listener is called
                    // the CRC32 will be already calculated
                    setTimeout(function(){
                        result = fileInfos[i].getFooter().slice(-(size - startByte));
                        listener({target : {result : result, readyState : FileReader.DONE}});
                    }, 0);
                    return;
                }
            }
            
            size += centralDirectoryArray.byteLength;
            if(size > startByte){
                setTimeout(function(){
                    result = centralDirectoryArray.slice(-(size - startByte));
                    listener({target : {result : result, readyState : FileReader.DONE}});
                }, 0);
                return;
            }
            setTimeout(function(){
                result = endOfCentralDirectoryArray.slice(startByte - size);
                listener({target : {result : result, readyState : FileReader.DONE}});
            }, 0);
        //});
    }
}

Zip.isSingleFile = function(dataTransfer){
    var items = dataTransfer.items;
    var files = dataTransfer.files;
    if(typeof items != "undefined"){
        if(items.length > 1){
            return false;
        }
        return items[0].webkitGetAsEntry().isFile;
    }else if(typeof files != "undefined"){
        if(files.length > 1){
            return false;
        }
    }
    return true;
}

function CRC32(){
    var makeCRCTable = function(){
        var c, crcTable = [];
        for(var n =0; n < 256; n++){
            c = n;
            for(var k =0; k < 8; k++){
                c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            }
            crcTable[n] = c;
        }
        return crcTable;
    }
    
    var crcTable = window.crcTable || (window.crcTable = makeCRCTable());
    var crc = 0 ^ (-1);
    
    this.add = function(arrayBuffer) {
        for (var i = 0; i < arrayBuffer.byteLength; i++ ) {
            crc = (crc >>> 8) ^ crcTable[(crc ^ arrayBuffer[i]) & 0xFF];
        }
        return this;
    }
    
    this.end = function(){
        return (crc ^ (-1)) >>> 0;        
    }
}
