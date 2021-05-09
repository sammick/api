const nlshort = require('./functions/nlshort');
const { sample, size, isString } = require('lodash');
const chalk = require('chalk');
var fs = require('fs');
var _ = require('lodash');
var path = require('path');
var express = require('express');
const shortid = require('shortid');
var CronJob = require('cron').CronJob;

(async function() {

    console.log(chalk`yellow API is started.`);

    if (!fs.existsSync('./cookies/')){
        fs.mkdirSync('./cookies/');
    }
    if (!fs.existsSync('./saved/')){
        fs.mkdirSync('./saved/');
    }
    
    const app = express()
    const hostname = '127.0.0.1';
    const port = 3000

    app.use(express.static('public'));
    app.use(express.static('dist'));
    app.use('/saved', express.static('saved'));
    app.set('saved', path.join(__dirname, 'saved'));
    app.set('views', path.join(__dirname, 'views'));
    app.set('co_dir', path.join(__dirname, 'cookies'));
    app.set('view engine', 'pug');
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.locals.basedir = path.join(__dirname, 'views');
    // CORS middleware
    const allowCrossDomain = function(req, res, next) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', '*');
        res.header('Access-Control-Allow-Headers', '*');
        next();
    }
    app.use(allowCrossDomain);

    app.route('*')
    .all(async function(req, res) {

        console.log('req.method', req.method.toLowerCase());
        var pdata = req.body;
        console.log('pdata', pdata);

        if( req.method.toLowerCase() == 'get' ) {
            res.sendFile( path.join(__dirname, './dist/index.html') );
        }

        if( typeof +pdata.id == 'undefined') {
            pdata.done = false;
            res.json(pdata);
        }

        console.log('req.path', req.path);
        if( req.method.toLowerCase() == 'post' ) {
            switch (req.path) {
                case '/login':
    
                    var o = {
                        is_loggedin: false
                    }
    
                    let { username = '', password = ''} = pdata;
    
                    if( username == false || password == false ) {
                        o.message = `${username ? 'Password' : 'Username'} can not be empty!`; 
                        res.json(o);
                        break;
                    }
                    
                    var client = await nlshort.has_or_login({ username, password });
    
                    // console.log('clientclient', client);
                    if( ! client ) {
                        res.json(o);
                    } else {
                        console.log('loggin passed', client.credentials.username);
                        // await client.getProfile().then(console.log);
                        console.log('getting states');
                        var getState = await nlshort.create_user_state(username, client, password);
                        o.is_loggedin = true;
                        console.log('getting states...................')
                        o = {...o, ...getState};
                        res.json(o);
                        return;
                    }
                    break;
    
                case '/getuser':
                    if( pdata?.username ) {
                        userDataName = '' + pdata.username;
                        try {
                            const db = await nlshort.db.create('./cookies/'+userDataName+'_db.json');
                            var sanitized_posts = db.get('posts').filter(el => el && size(el) >= 0 ).value();
                            db.set('posts',sanitized_posts).write();
                            res.send( JSON.stringify({...db.getState(), ...{status: 'Ok', is_user: true}}) );
                            return;
                        } catch (error) {
                            res.json(Object.assign({status: 'Ok', is_user: false, message: 'error'}, pdata))
                        }
                    } else {
                        res.json(Object.assign({status: 'Ok', is_user: false, message: 'user can not found'}, pdata))
                    }
                    break;
                
                case '/doaccout':
                    try {
                        if( pdata?.username ) {
                            
                            const user = await nlshort.db.create('./cookies/'+pdata.username+'_db.json');

                            console.log('searchout');
                            if(pdata?.action == 'search') {
                                if( !pdata?.query ) {
                                    res.json({status: 'Ok', actiondone: false, msg: 'unvalid search query!'});
                                    return;
                                }
                                console.log('search');
                                var client = await nlshort.has_or_login({ 
                                    username: pdata.username,
                                    password: user.get('user.password').value(),
                                    direct: true
                                })
                                console.log('client', client);
                                var searchSesults = await client.search({ query: pdata.query, context: 'user' })
                                console.log('searchSesults', searchSesults);
                                res.json(Object.assign({status: 'Ok', is_user: true, actiondone: true}, searchSesults ));
                                return;
                            }

                            if( pdata?.action == 'update' ) {
                                pdata.accounts = pdata.accounts.filter(el => Object.keys(el).length);
                                console.log(pdata.accounts);
                                user.set('accounts', pdata.accounts).write()
                                res.json(Object.assign({status: 'Ok', is_user: true, actiondone: true}));
                                return;
                            }
                            var newuser = pdata?.account || false
                            if( newuser ) {
                                if( +newuser.id === 0 ) delete newuser.id;
                                newuser.unique = shortid();
                                user._.createId = (collectionName, item) => collectionName.length + 1;
                                newuser = user.get('accounts').upsert(newuser).write();
                                res.json(Object.assign({status: 'Ok', is_user: true, user: newuser}, pdata))
                            }
                        }
                        return;
                    } catch (error) {
                        console.log(error);
                        res.json(Object.assign({status: 'Ok', is_user: false, user: null, message: 'abe na'}, pdata))
                    }
                    break;

                case '/dopost':
                    try {
                        if( pdata?.posts ) {
                            const user = await nlshort.db.create('./cookies/'+pdata.username+'_db.json');
                            await user.set('posts', pdata.posts).write();
                            res.json(Object.assign({status: 'Ok', is_user: true, posts: user.get('posts').value()}))
                        }
                        return;
                    } catch (error) {
                        console.log(error);
                        res.json(Object.assign({status: 'Ok', is_user: false, message: 'abe na'}, pdata))
                    }
                    break;
                
                case '/addpost':
                    if( pdata?.username ) {
                        const user = await nlshort.db.create('./cookies/'+pdata.username+'_db.json');
                        var client = await nlshort.has_or_login({ 
                            username: pdata?.username,
                            password: user.get('user.password').value(),
                            direct: true
                        })
                        if( client ) {
                            try {
                                var addpost = isString(pdata?.shortcode) ? await client.getMediaByShortcode({ shortcode: pdata?.shortcode }) : pdata.post;
                                addpost.getfrom = 'direct';
                                addpost.posttype = 'feed';
                                addpost = await nlshort.save_post({post: addpost});
                                if( pdata?.save_data ) user.get('posts').upsert(addpost).write();
                                res.json( {status: 'Ok', is_user: true, addpost} );
                                return;
                            } catch (error) {
                                
                            }
                        }
                        res.json(Object.assign({status: 'Ok', is_user: true, message: 'abe na'}, pdata, {addpost}));
                    } else {
                        res.json(Object.assign({status: 'Ok', is_user: false, message: 'abe na'}, pdata));
                    }
                    break;
    
                case '/removepost':
                    console.log(pdata);
                    if( pdata?.username && pdata?.post ) {
                        const user = await nlshort.db.create('./cookies/'+pdata.username+'_db.json');
                        await nlshort.removePost(pdata.post);
                        user.get('posts').removeById(pdata.post.id).write();
                        res.json(Object.assign({status: 'Ok', is_user: true, is_removed: true}));
                    } else {
                        res.json(Object.assign({status: 'Ok', is_user: false, message: 'Post did not removed.'}, pdata));
                    }
                    break;

                case '/gethomefeed':
                    if( pdata?.username && pdata?.end_cursor != undefined ) {
                        const user = await nlshort.db.create('./cookies/'+pdata.username+'_db.json');
                        var client = await nlshort.has_or_login({ 
                            username: pdata?.username,
                            password: user.get('user.password').value()
                        })
                        if( client ) {
                            try {
                                console.log('getting Home...');
                                var homefeed = await client.getHome(pdata?.end_cursor);
                                console.log('homefeed',homefeed);
                                res.json( {status: 'Ok', is_user: true, timeline: homefeed.data?.user?.edge_web_feed_timeline} );
                                return;
                            } catch (error) {
                                
                            }
                        } else {
                            res.json(Object.assign({status: 'Ok', is_user: true, message: 'User did not login.'}, pdata));
                        }
                    } else {
                        res.json(Object.assign({status: 'Ok', is_user: false, message: 'Username is not set!'}));
                    }
                    break;
                
                case '/postaction':
                    if( pdata?.username ) {
                        const user = await nlshort.db.create('./cookies/'+pdata.username+'_db.json');
                        var client = await nlshort.has_or_login({ 
                            username: pdata?.username,
                            password: user.get('user.password').value()
                        })
                        if( client ) {
                            try {
                                var mediaId = await client.like({mediaId: pdata.mediaId});
                                res.json( {status: 'Ok', is_user: true, mediaId} );
                                return;
                            } catch (error) {
                                
                            }
                        }
                        res.json(Object.assign({status: 'Ok', is_user: true, message: 'abe na'}, pdata));
                    } else {
                        res.json(Object.assign({status: 'Ok', is_user: false, message: 'abe na'}, pdata));
                    }
                    break;
                
                default:
                    res.json(Object.assign({status: 'Ok', action: 'Nothing happened!'}))
                    break;
            }
        }


    });
    app.listen(port, () => {
      console.log(`Example app listening at http://localhost:${port} d`)
    });

    // Downling Posts
    var accounts = new CronJob('1 6,12,15,18 * * *', async function() {

        console.log(chalk`{yellow Started checking for new Posts...}`);
        var users = await nlshort.getUserNames();
        if( users.length ) {
            for (let z = 0; z < users.length; z++) {
                const user = users[z];
                try {
    
                    const userdb = await nlshort.db.create('./cookies/'+user+'_db.json');
                    console.log( chalk`{yellow ${user} is logining..}`);
                    var client = await nlshort.has_or_login({ username: user, password: userdb.get('user.passoword').value() });
                    if( ! client ) {
                        console.log( chalk`{yellow ${user} has something wrong with logining..}`);
                        continue;
                    }
    
                    var userAccounts = userdb.get('accounts').value();
                    if( userAccounts.length ) {
                        accountloop: for (let y = 0; y < userAccounts.length; y++) {
                            var account = userAccounts[y];
                            if(size(account) <= 0) continue accountloop;
                            console.log('Current loop is', account.username);
                            if( Object.keys(account).length <= 0 ) {
                                console.log('Error at ', y);
                                userAccounts.splice(y+1, 1);
                                continue;
                            }
                            try {
                                var next = true,
                                    end_cursor = '';
                                nextwhile: while(next) {
        
                                    next = false;
                                    var photos = await client.getPhotosByUsername({ username: account.username });
                                    photos = photos.user.edge_owner_to_timeline_media;
            
                                    if( +account?.postfrom == 0 ) {
        
                                        account.postfrom = photos.count;
                                        account = userdb.get('accounts').updateById(account.id, account).write();
                                        console.log(chalk`{green ${user} will get posts from ${account.username}/${photos.count} }`);
                                        continue accountloop;
        
                                    } else if( photos.count > +account?.postfrom ) {
                                        
                                        var getnumber = photos.count - +account?.postfrom;
                                        console.log(chalk`{green ${account.username} has ${getnumber} new post(s).}`);
                                        for (let i = 0; i <= getnumber; i++) {
                                            await nlshort.delay(10)
                                            account.postfrom++;
                                            var el = photos.edges[i];
                                            el = el.node;
                                            if( el.__typename !== 'GraphImage' ) continue;
                                            el.owner.username = account.username;
                                            el.getfrom = 'profile';
                                            el.posttype = 'feed';
                                            el = await nlshort.save_post({post: el});
                                            el = nlshort.sortKeys(el);
                                            el = userdb.get('posts').upsert(el).write();
                                            console.log(chalk`{green ${el.shortcode} added from ${account}}`);
                                        }
                                        account.postfrom--;
                                        account = userdb.get('accounts').updateById(account.id, account).write();
                                        next = photos.page_info.has_next_page;
                                        end_cursor = photos.page_info.end_cursor;
            
                                    } else {
        
                                        next = false;
                                        console.log( chalk`{yellow ${account.username} does not have any new post!}`);
        
                                    }
                                }
        
                            } catch (error) {
                                console.log( chalk`{yellow ${account.username} has problem with getting data. Maybe! ${account.username} has wrong..}`, error);
                            }
                        }
                    } else {
                        console.log( chalk`{red ${user} Not have account to get post from.. \n}`);
                    }
                    userdb.get('accounts').filter(el => Object.keys(el).length).write();
                    await nlshort.delay(180);

                } catch (error) {
                    console.log( chalk`{yellow ${user}}`, error);
                    continue;
                }
            }
        }

    }, null, true, 'Asia/Kolkata');
    accounts.start();

    var DownloadingStories = new CronJob('1 6,9,12,15,18 * * *', async function() {
    // (async function() {

        nlshort.delay(10)
        console.log(chalk`{yellow Started checking for new Stories...}`);
        await nlshort.UsersLoop(async function(user){
            var accounts = user.get('accounts'),
                username = user.get('user.username').value(),
                password = user.get('user.password').value();

            var client = await nlshort.has_or_login({ username, password });
            console.log('sotvvv', client.credentials);
            if( !client ) return;

            var laccounts = accounts.filter(el => el.story).value();
            for (let l = 0; l < laccounts.length; l++) {

                const account = laccounts[l];
                console.log(chalk`{cyanBright Fetching Stories from ${account.username}.}`);
                
                var reels = await client.getStoryReels({reelIds: [account.pk]})
                var reelUser = reels[0]; 
                reels = reels[0].items;

                if( reels.length ) {

                    if( reelUser.seen != null ) {
                        reels = reels.filter(reel => reelUser.seen < reel.taken_at_timestamp);
                    }
                    console.log(chalk`{yellow ${reelUser.owner.username} has ${reelUser.items.length} story(s) ${ reelUser.seen != null ? ' and ' + ( reelUser.items.length - reels.length )  + ' has seen. Now to see : ' + (reels.length) : '.' } }`);
                    
                    if( reels.length ) {
                        for (let index = 0; index < reels.length; index++) {

                            var reel = reels[index];
                            var nextreeltime = reel.__typename == 'GraphStoryImage' ? 10 : 5;
                            console.log( `{green ${index+1}/${reels.length} story }`, reel.__typename);
                            
                            if( reel.__typename == 'GraphStoryImage') {
                                reel.owner    = account;
                                reel.getfrom  = 'story';
                                reel.posttype = 'story';
                                console.log('reedid', reel.id);
                                var savedreel = await nlshort.save_post({post: reel});
                                console.log('savedreel', savedreel.id);
                                savedreel = nlshort.sortKeys(savedreel);
                                savedreel = user.get('posts').upsert(savedreel).write();
                                console.log(chalk`{green Story has saved to upload. \n}`);
                            }

                            var storyseen = await client.markStoryItemAsSeen({
                                reelMediaId: reel.id,
                                reelMediaOwnerId: reel.owner.id,
                                reelId: reel.owner.id,
                                reelMediaTakenAt: reel.taken_at_timestamp,
                                viewSeenAt: reel.taken_at_timestamp
                            })
                            console.log( `{yellow ${index+1}/${reels.length} story has ${storyseen.status}}`);
                            
                            if( reels.length - 1 != index  ) {
                                console.log(chalk`{cyanBright Next Reel of ${reel.owner.username} in ${nextreeltime} second(s).}`);
                            }
                            await nlshort.delay(nextreeltime)

                        }   
                    } else {
                        console.log(chalk`{cyanBright  ${reelUser.owner.username} has seen all post already.}`);
                    }

                }

            }

        })
        
    // })();
    }, null, true, 'Asia/Kolkata');
    DownloadingStories.start();



    // Uploading Stories
    var uploadingStories = new CronJob('10 6,10,14,18,20 * * *', async function() {
        await nlshort.UsersLoop(async function(user){
            if( user.get('posts').value().length  ) {
                console.log(chalk`{redBright Started uploading stories..}`);
                var stories = await user.get('posts').filter(el => el.uploadto.story &&  el.uploadedto.story == false && el.posttype == 'story' ).value();
                console.log(stories.length, ' to upload on story!');
                var client = await nlshort.has_or_login({ 
                    username: user.get('user.username').value(),
                    password: user.get('user.password').value()
                })
                if( stories.length && client ) {
                    for (let y = 1; y <= 3; y++) {
                        var story = stories[ y - 1 ];
                        await client.uploadPhoto({photo: story.nlpath?.story || story.nlpath?.full , post: 'story'})
                        .then(el => {
                            console.log(`${y + '/' + stories.length}: Story Uploaded`);
                            story.uploadedto.story = true;
                            console.log(story);
                            user.get('posts').updateById( story.id, story).write();
                        }).catch(err => {
                            console.log(`${i + '/' + storys.length}: Story did not Uploaded`);
                            // db.get('posts').remove({ id: el.id }).write();
                        });
                        await nlshort.delay(240);
                    }
                };


            } else {
                console.log(chalk`{redBright There is nothing to upload on story..}`);
            }
        });
    }, null, true, 'Asia/Kolkata');
    uploadingStories.start();



    // Uploading Posts
    var uploadingPosts = new CronJob('30 9,12,15,18 * * *', async function() {
        await nlshort.UsersLoop(async function(user){
            if( user.get('posts').value().length  ) {
                console.log(chalk`{redBright Started uploading stories..}`);
                var feeds = await user.get('posts').filter(el => el.uploadto.feed &&  el.uploadedto.feed == false && el.posttype == 'feed').value();
                console.log(feeds.length, ' to upload on story!');
                var client = await nlshort.has_or_login({ 
                    username: user.get('user.username').value(),
                    password: user.get('user.password').value()
                })
                if( feeds.length && client ) {
                    for (let y = 1; y <= 3; y++) {
                        var feed = feeds[ y - 1 ];
                        var caption = [`via ${user.get('user.username').value()} @${feed.username} \n`, feed.caption].join('')
                        await client.uploadPhoto({photo: feed.nlpath?.feed || feed.nlpath?.full, post: 'feed', caption})
                        .then(el => {
                            console.log(`${y + '/' + feeds.length}: Feed Uploaded`);
                            feed.uploadedto.feed = true;
                            console.log(feed);
                            user.get('posts').updateById( feed.id, feed).write();
                        }).catch(err => {
                            console.log(`${y + '/' + feeds.length}: Feed did not Uploaded`);
                            // db.get('posts').remove({ id: el.id }).write();
                        });
                        await nlshort.delay(240);
                    }
                };

            } else {
                console.log(chalk`{redBright There is nothing to upload on story..}`);
            }
        });
    }, null, true, 'Asia/Kolkata');
    uploadingPosts.start();

})();


// delay lowdb request instagram-web-api instagram-id-to-url-segment lodash-id shortid sort-keys lodash chalk path express shortid cron sort-keys