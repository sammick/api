var delay = require('delay');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const fs = require('fs');
const request = require('request');
const Instagram = require('instagram-web-api');
const FileCookieStore = require('tough-cookie-filestore2');
const { isNull, map, isNumber, isObject, isString, forEach } = require('lodash');
var {instagramIdToUrlSegment, urlSegmentToInstagramId} = require('instagram-id-to-url-segment');
const { type } = require('os');
const chalk = require('chalk');
const lodashId = require('lodash-id');
const shortid = require('shortid');
const axios = require('axios');
const path = require('path');

var nlshort = {
  sortKeys(unordered) {
    return Object.keys(unordered).sort().reduce(
      (obj, key) => { 
        obj[key] = unordered[key]; 
        return obj;
      }, 
      {}
    );
  },
  async delay(second = 5, log = '', r = false) {  
    second *= 60;
    var min = second/2,
        max = second/2 + second;
    if( r ) return {min, max}
    return new Promise(async (resolve, reject) => {
      log && console.log(log);
      await delay(this.getRndInteger(max,min))
      resolve("done!");
    });
  },
  getRndInteger: function(max, min) {
    return Math.floor(Math.random() * (max - min + 1) ) + min;
  },
  db: {
    userdefault(options = {}) {
      
    },
    get_or_set(property = '', value = '', db){
      db.has(property) || db.set(property, value).write()
      return db.get(property).value();
    },
    push(property, value, db) {
      console.log('dontihjg');
    },
    async create(x, defaults = {}){
      return new Promise(async function(resolve){
        const adapter = new FileSync(x);
        const db = low(adapter);
        db.defaults(defaults).write();
        db._.mixin(lodashId);
        resolve(db);
      })
    }
  },
  restrict: function(req, res, next) {
    console.log(req.session);
    if (req.session.username) {
      next();
    } else {
      req.session.error = 'Access denied!';
      res.redirect('/login');
    }
  },
  async has_or_login(options){

    var obj = this;
    return new Promise(async function(resolve) {

      var { username = '', password = '', client = null, direct = false } = options;

      if( isNull(client) || typeof client != 'object' ){
        const cookieStore = await new FileCookieStore( './cookies/' + username + '_cookies.json');
        client = new Instagram({ username, password, cookieStore });
        if(direct) {
          resolve(client);
          return;
        }
      }

      console.log('client', client);
      var nada = await client._getSharedData();
      if(  ! nada?.config?.viewer ) {
      // if(  false ) {
          var mnn = ''
          try {
              mnn = await client.login()
              console.log( 'Checklogin Login', mnn );
              if( !mnn.authenticated ) {
                console.log('Authenticated', mnn.authenticated, mnn );
                resolve(false);
              }
              resolve(client);
          } catch (error) {
              console.log( 'Login of Dmmy eroor', error);
              resolve(false);
          }
          
      } else {
        console.log( 'Logged In as :', username);
        resolve(client);
      }
    });

    
  },
  async create_user_state( username = '', client = null, password = ''){
    var obj = this;
    return new Promise(async function(resolve) {
      const db = await obj.db.create(`./cookies/${username}_db.json`, defaults = {
          posts: [],
          user: {},
          post_opts: {},
          saving_opts: {},
          hashtags: [],
          accounts:[],
          username,
          password
      });

      console.log('create_user_stateclinet', username);
      if( isNull(client) ) {
        client = await obj.has_or_login({ username, password });
      }

      var set_user = await obj.set_user({username, client});
      set_user.password = password;
      // console.log('set_user', set_user);
      if(set_user) db.set('user', set_user).write();
      resolve(db.getState());
    });
  },
  async set_user( options = { username: '', client: false } ) {
    var { username = '', client = false } = options;
    return new Promise(async function(resolve) { 
      try {
        console.log('Setting user data...', username);
        var user     = await client.getProfile();
        // delete user.profile_edit_params;
        console.log('user profile fetched');
        var userdata = await client.getUserByUsername({ username: username || client.credentials.username });
        console.log('userdata fetched');
        // [ 'edge_felix_combined_post_uploads', 'edge_felix_combined_draft_uploads','edge_felix_video_timeline',
        //   'edge_felix_drafts','edge_felix_pending_post_uploads','edge_felix_pending_draft_uploads','edge_owner_to_timeline_media',
        //   'edge_saved_media','edge_media_collections', 'edge_mutual_followed_by', 'requested_by_viewer'].map(el => {
        //   delete userdata[el];
        // });
        userdata = {...user, ...userdata};
        console.log('Setting user data...', Object.keys(userdata).length);
        resolve(userdata);
      } catch (error) {
        console.log(error);
        resolve(false);
      }
      resolve(false);
    });
  },
  async download(uri, filename = '../saved', callback = function(file){console.log(file);}){
    return new Promise(async function(resolve) { 
      if( fs.existsSync(filename) ) resolve(true);
      request.head(uri, function(err, res, body){
        request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
        resolve(true);
      });
    })
  },
  async downloadImage(url, path) {  
    if( fs.existsSync(path) ) resolve(path);
    const writer = fs.createWriteStream(path)
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream'
    })
    response.data.pipe(writer)
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    })
  },
  async createStoryImage(post, output = ''){  
    var obj = this;
    return new Promise(async function(resolve) {
      console.log(chalk`{red Creating Story Image...}`, post.posttype);

      if(post.posttype == 'story') {
        resolve(post.nlpath.full);
      }

      var serveruri = 'http://localhost:8000';

      if(post.posttype == 'feed') {
        await axios
          .post(serveruri+'/createstory', post)
          .then(async res => {
            console.log(res.data, output)
            console.log('delya', new Date());
            await obj.delay(30)
            console.log('after delya', new Date());
            await obj.downloadImage(`${serveruri}/uploads/${res.data.story}`, output);
            console.log(chalk`{yellow Story size Saved... innewr}`);
            resolve(res.data.story);
          })
          .catch(error => {
            console.error(error)
          })
      }

      console.log(chalk`{yellow Story size Saved... outter}`);
      resolve(post.nlpath.full);

    })
  },
  async createFeedImage(post, output = ''){  
    var obj = this;
    return new Promise(async function(resolve) {
      
      console.log(chalk`{red Creating Feed Image...}`);

      if(post.from == 'feed') {
        resolve(post.full);
      }
      
      var output = '';
      console.log(obj.name, output)

      console.log('output', output);
      resolve(output);

    })
  },
  createFilename(post = {}, last){
    return ( post.owner?.username || post.owner?.id || 'nill' ) + '_' + post.shortcode + '_' + last +  ( post.is_video ? '.mp4' : '.jpg' );
  },
  async downloadPostData(options = { post, path }) {
    var obj = this;
    return new Promise(async function(resolve) { 

      console.log('download stated');
      var { post = null, path = null} = options;
      var o = {},
      nlpath = {
        story: '',
        feed: '',
        thumbnail: '',
        photo: '',
        full: '',
      },
      type = post?.type,
      filepath  = function(last){
        return './saved/' + ( post.owner?.username || post.owner?.id || 'nill' ) + '_' + post.shortcode + '_' + last + '.jpg';
      };


      if( type === undefined || type == 'notype' ) {
        console.log(chalk`{red Post type is not set.}`);
        resolve( { ...o, ...{ nlpath } } );
      }
      
      if( type == 'photo' ) {
        
        var thumbnail = post?.thumbnail_src || post.display_resources[0].src;
        if( thumbnail ) {
          await obj.download(thumbnail, filepath('thumbnail'), function(filename){
              nlpath.thumbnail = obj.createFilename({ ...o, ...post}, 'thumbnail');
              console.log(chalk`{cyanBright Thumbnail size Saved...}`);
          })
          await obj.delay(30, chalk`{yellow Thumbnail downloading...}`);
        }

        await obj.download(post.display_url, filepath('full'), async function(filename){
          nlpath.full = nlpath.photo = obj.createFilename({ ...o, ...post}, 'full');
          console.log(chalk`{cyanBright full size Saved...}`);
          await nlshort.delay(3);
          nlpath.story = await obj.createStoryImage({ ...o, ...post, ...{nlpath} }, './saved/' + obj.createFilename({ ...o, ...post}, 'story'));
          nlpath.feed = nlpath.full;
        })
        await obj.delay(30, chalk`{yellow Full Photo downloading...}`);

      } else {
        console.log(chalk`{red Post type is not photo.}`);
      }
      console.log('Download Ended!');
      resolve(obj.sortKeys({ ...o, ...{ nlpath } }));
    })

  },
  settype(postOrStory) {
    var o = {};
    switch (postOrStory.__typename) {
      case 'GraphVideo':
        o.type = 'video';
        break;
      case 'GraphImage':
        o.type = 'photo';
        break;
      case 'GraphSidecar':
        o.type = 'album';
        break;
      default:
        o.type = 'notype';
        break;
    }
    return o;
  },
  async sanitize_post( post ) {
    var obj = this;
    return new Promise(async function(resolve) {
      
      var o = {};

      map({
        nlpath: {},
        is_hold: false,
        uploadto: { 
          story: false,
          feed: false,
        },
        uploadedto: {
          story: false,
          feed: false,
        },
      }, (val, key) => {
        o[key] = post?.[key] || val;
      });

      o                       = { ...o, ...obj.settype(post) };
      o.id                    = +post.id;
      o.dimensions            = post.dimensions;
      o.accessibility_caption = post?.accessibility_caption || '';
      o.shortcode             = post?.shortcode || '';
      o.caption               = ( post?.edge_media_to_caption?.edges?.length && post?.edge_media_to_caption?.edges[0].node.text ) || '';
      o.media_preview         = post?.media_preview || '';
      o.taken_at_timestamp    = post?.taken_at_timestamp || 0;
      o.likes                 = post?.edge_media_preview_like?.count || 0;
      o.location              = post?.location || {};
      o.tagged_users          = post?.edge_media_to_tagged_user?.edges || [];
      o.owner                 = post?.owner || {};

      resolve(o);

    });
  },
  async save_post(post = { post, id, shortcode, client }) {
    var { post = null, id = null, shortcode = null, client = null } = post;
    var obj = this;
    return new Promise(async function(resolve) { 
    
      if( isNull(post) && isNull(id) && isNull(shortcode) ) {
        console.log(chalk`{red Pass atleast PostObj,ID and ShortCode!...}`);
        resolve(false);
      }
      
      var o = {},
      paths = {},
      sanitize_post = {};

      if( post ) console.log(chalk`{green Post is saving by Post Obj...}`);

      if( isString(shortcode) ) {
        console.log(chalk`{green Post is saving by ShortCode...}`);
        post = await client.getMediaByShortcode({ shortcode });
        o.getfrom = 'shortcode';
        o.posttype = 'feed';
      }

      if( isNumber(id) ) {
        console.log(chalk`{green Post is saving by ID...}`);
        post = await client.getMediaByShortcode({shortcode: instagramIdToUrlSegment(id)})
        o.getfrom = 'id';
        o.posttype = 'feed';
      }


      // Sanitizing the post 
      o.type = post.type = obj.settype(post).type;
      console.log('Setted post type...', post.type );
      sanitize_post = await obj.sanitize_post(post);
      console.log('Sanitized Post ...', post.shortcode);
      o = { ...o, ...sanitize_post };

      paths = await obj.downloadPostData({post});
      o = { ...o, ...paths, ...{ unique: shortid() } };

      console.log(chalk`{yellow "${ o?.shortcode || o.id}" - Post has Saved.}`);
      resolve( obj.sortKeys(o) );
    });
  },
  async getUserNames(file = "") {
    return new Promise((resolve => {
      var filenames = fs.readdirSync(file || './cookies/');
      filenames = filenames.filter(el => el.endsWith('_db.json')).map(el => el.replace('_db.json', ''))
      resolve(filenames);
    }))
  },
  async UsersLoop(cl = function(user = ''){}) {
    var obj = this;
    return new Promise(async function(resolve) {
      var users = await obj.getUserNames('./cookies/');
      if( users.length ) {
        for (let z = 0; z < users.length; z++) {
          var user = users[z];
          user = await nlshort.db.create('./cookies/'+user+'_db.json');
          await cl(user);
        }
      }
      resolve(true);
    });
  },
  async removePost(post){
    var obj = this;
    return new Promise(async function(resolve) {
      forEach(post.nlpath, (val, key) => {
        if( val.length ) {
          try {
            if( fs.existsSync(val) ) {
              fs.unlinkSync(val);
              console.log('val', val);
            }
          } catch(err) {
            console.error(err);
          }
        }
      });
      resolve(true)
    })
  }
};

module.exports = nlshort;