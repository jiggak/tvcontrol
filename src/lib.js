const Lang = imports.lang;
const Signals = imports.signals;

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

String.prototype.toBytes = function() {
   var bytes = [];
   for (var i = 0; i < this.length; ++i) {
      bytes.push(this.charCodeAt(i));
   }
   return bytes;
};

String.prototype.startsWith = function(prefix) {
   return this.indexOf(prefix) === 0;
};

String.prototype.endsWith = function(suffix) {
   return this.length > 0 && this.indexOf(suffix) === this.length - 1;
};

const LG_Cmd_Power = 'ka';
const LG_Cmd_Volume = 'kf';

const TvController = new Lang.Class({
   Name: 'TvControlMenu.TvController',

   open: function(params) {
      let port = params.port? params.port : '/dev/ttyUSB0';

      let stty = ['stty',
         '-F', port,
         '9600', // baud rate
         'cs8', // 8 data bits
         '-cstopb', // 1 stop bits
         '-parenb', // parity none
         '-crtscts', // no hardware handshake (RTS/CTS)
         '-ixon' // no software handshake (XON/XOFF)
      ];

      this._power = false;
      this._volume = 0;

      // settup serial port
      let [retval, stdout, stderr, error] = GLib.spawn_sync(
         null, stty, null, GLib.SpawnFlags.SEARCH_PATH, null);

      if (error !== 0) {
         log('warning: failed to set serial port settings');
         log(stderr.toString().trim());
      }

      try {
         let file = Gio.File.new_for_path(port);

         this._stream = file.open_readwrite(null);
         this._out = this._stream.get_output_stream();

         this._in = new Gio.DataInputStream({
            base_stream: this._stream.get_input_stream()
         });

         this._in.set_newline_type(Gio.DataStreamNewlineType.CR);

         this._sendCommand(LG_Cmd_Power, 'FF');
      } catch (err) {
         log('error: failed to open serial port');
         log(err);
      }
   },

   close: function() {
      if (this._stream) {
         this._stream.close(null);
         this._stream = this._in = this._out = null;
      }
   },

   _sendCommand: function(cmd, arg, callback) {
      if (!this._stream) return;

      if (typeof arg !== 'string') arg = arg.toString();
      if (arg.length < 2) arg = '0' + arg;

      // ID is in the TV settings, 00 addresses all TVs
      let tvid = '00';

      let params = [cmd, tvid, arg];
      let data = (params.join(' ') + '\r').toBytes();

      this._out.write(data, null);
      this._out.flush(null);

      this._in.read_upto_async('x', 1, GLib.PRIORITY_DEFAULT, null,
         Lang.bind(this, this._receiveAsync));
   },

   _receiveAsync: function(source, result) {
      let [line, length] = source.read_upto_finish(result);
      source.skip(1, null); // discard the stop char

      let parts = line.split(' ');
      let cmd = parts.shift();

      parts.shift(); // skip TV ID

      let ack = parts.shift();

      if (ack.startsWith('OK')) {
         let data = ack.substr(2);

         if (LG_Cmd_Power.endsWith(cmd)) {
            let power = parseInt(data) === 1;

            // when transitioning from off to on get the volume
            if (this._power === false && power === true) {
               // delay here is required for a few reasons
               // 1) sending right after receiving seems to cause strange
               //    issues with the async reads (i.e. first response appears twice)
               // 2) attempting to get the volume right after power-on doesn't work
               //    need to wait for the TV to finish turning on
               GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, Lang.bind(this, function() {
                  this._sendCommand(LG_Cmd_Volume, 'FF');
               }));
            }

            this._power = power;
            this.emit('power-changed', this._power);
         } else if (LG_Cmd_Volume.endsWith(cmd)) {
            this._volume = parseInt(data, 16);
            this.emit('volume-changed', this._volume);
         } else {
            log('warn: unrecognized ack "'+line +'"');
         }
      } else {
         log('error: non-OK ack "'+line+'"');
      }
   },

   power: function(onoff) {
      if (onoff !== undefined) {
         this._sendCommand(LG_Cmd_Power, onoff? '1' : '0');
      }

      return this._power;
   },

   volume: function(level) {
      if (level !== undefined && this._power) {
         level = Math.round(level).toString(16);
         this._sendCommand(LG_Cmd_Volume, level);
      }

      return this._volume;
   }
});

Signals.addSignalMethods(TvController.prototype);
