const nlshort = require('./functions/nlshort');

(async function(){

    var llist = await nlshort.getUserNames('./cookies/');
    var UsersLoop = await nlshort.UsersLoop()
    console.log(llist);

})()