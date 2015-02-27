const St = imports.gi.St;
const Lang = imports.lang;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Lib = Me.imports.lib;

const PowerMenuItem = new Lang.Class({
   Name: 'TvControlMenu.PowerMenuItem',
   Extends: PopupMenu.PopupSwitchMenuItem,

   _init: function() {
      this.parent('');

      this.label.text = 'Power';

      this.connect('toggled', Lang.bind(this, this._onToggle));

      _controller.connect('power-changed', Lang.bind(this, function(source, power) {
         this.setToggleState(power);
      }));
   },

   // replaces the base class method so that we can keep popup visible
   activate: function(event) {
      if (this._switch.actor.mapped) {
         this.toggle();
      }
   },

   _onToggle: function(actor, value) {
      _controller.power(value);
   }
});

const VolumeMenuItem = new Lang.Class({
   Name: 'TvControlMenu.VolumeMenuItem',
   Extends: PopupMenu.PopupMenuItem,

   _init: function() {
      this.parent('');

      this.actor.add(new St.Icon({
         icon_name: 'audio-volume-high-symbolic',
         style_class: 'popup-menu-icon'
      }));

      let slider = new Slider.Slider(0.0);
      slider.connect('value-changed', Lang.bind(this, this._onSliderChanged));

      this.actor.add(slider.actor, { expand: true });

      _controller.connect('volume-changed', Lang.bind(this, function(source, volume) {
         slider.setValue(volume / 64.0);
      }));
   },

   _onSliderChanged: function(actor, value) {
      _controller.volume(value * 64);
   }
})

const TvControlMenu = new Lang.Class({
   Name: 'TvControlMenu.TvControlMenu',
   Extends: PanelMenu.Button,

   _init: function() {
      this.parent(0.0, 'TV Control');

      let icon = new St.Icon({
         icon_name: 'video-display-symbolic',
         style_class: 'system-status-icon'
      });

      this.actor.add_child(icon);

      this.menu.addMenuItem(new PowerMenuItem());
      this.menu.addMenuItem(new VolumeMenuItem());
   }
});

function init(metadata) {
   log ('TV Control extension initalized');
}

let _controller;
let _menu;

function enable() {
   log ('TV Control extension enabled');

   _controller = new Lib.TvController();
   _menu = new TvControlMenu();
   Main.panel.addToStatusArea('tv-control', _menu);

   _controller.open({port: '/dev/ttyUSB0'});
}

function disable() {
   log ('TV Control extension disabled');
   _menu.destroy();
   _controller.close();
}
