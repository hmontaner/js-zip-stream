# js-zip-stream

With this simple Javascript library you can zip files. It was originally implemented to be used in takeafile.com. This platform allows the transfer of files between browsers without intermediate servers, in a p2p fashion. Thus, when sending a folder with thousands of files they should be zipped in the browser itself. But files cannot be zipped in-memory, as they might be large.

This library allows files to be zipped in a stream. On one hand this makes the zip operation very fast. On the other hand this allows to pipeline the disk read with a network operation. For example, you can zip and send a folder with thousands of files without loading all of them at once into main memory.

This library works like a wrapper around a bunch of files or folders. You can treat them as they were a single pre-existing (zip) file: read it by chunks and send them through the network.
