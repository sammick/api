const delay = require('delay');
var dayjs = require('dayjs');
const nlshort = require('./nlshort');
const fs = require('fs');
const chalk = require('chalk');

module.exports = class IGLogin {
  serialize = '';
  username = '';
  password = '';
  is_login = false;
  stored_cookies = false;
  ig = {};
  autologin = false;

  constructor({username, password, cookies_file_path, ig, autologin = false, db}) {

    this.username = username;
    this.password = password;
    this.ig = ig;
    this.autologin = autologin;
    this.db = db;
    
    if(autologin) {
      console.log('useras',username, password)
      return this.login({username,password});
    }

  }

  checkfile() {
    this.serialize = nlshort.db.get_or_set('serialize', '', this.db);
  }

  async login({username = null, password = null, cookies_file_path}) {

    var ig = this.ig;
    this.checkfile(cookies_file_path);
    this.username = username ? username : this.username;
    this.password = password ? password : this.password;
    
    try {
      
      if( this.db.has('serialize') && this.db.get('serialize').value() ) {
        console.log(chalk`{yellow Deserializing..}`);
        await ig.state.deserialize( this.db.get('serialize').value() );
      } 
      await ig.simulate.preLoginFlow();
      const loggedInUser = await ig.account.login(this.username, this.password);
      await ig.simulate.postLoginFlow();
      console.log('Logged In ', loggedInUser.username, ' ', loggedInUser.full_name)

      this.is_login = true;
      
    } catch (error) {
      console.log('Login Error!',error);
      this.is_login = false;
    }

  }

};  