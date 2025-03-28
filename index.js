const util = require('util');

//const plugin = require('ih-plugin-api')();
const app = require('./app');

(async () => {

    let plugin;

    try {
        const opt = getOptFromArgs();
        const minversion = '5.17.82';
        const version = opt.version;
        const pluginapi = opt && opt.pluginapi ? opt.pluginapi : 'ih-plugin-api';
        plugin = require(pluginapi + '/index.js')();

        if (version >= minversion) {
            plugin.log('Plugin is start.');

            plugin.params = await plugin.params.get();
            plugin.log('Recieve plugin parametrs: ' + util.inspect(plugin.params), 1);

            plugin.channels = await plugin.channels.get();
            plugin.log('Recieve plugin channels: ' + util.inspect(plugin.channels), 1);

            plugin.logger.setParams({ logsize: plugin.params.logsize, logrotate: plugin.params.logrotate });

            app(plugin);
        }
        else {
            plugin.log("Plugin not start! Update system to version: " + minversion + " || Current version: " + version);
            plugin.exit(17, `Error: system version!`);
        }

    } catch (err) {
        plugin.exit(8, `Error: ${util.inspect(err)}`);
    }
})();

function getOptFromArgs() {
    let opt;
    try {
        opt = JSON.parse(process.argv[2]); //
    } catch (e) {
        opt = {};
    }
    return opt;
}
