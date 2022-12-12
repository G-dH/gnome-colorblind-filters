/**
 * ColorBlind Filters
 * extension.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2022
 * @license    GPL-3.0
 */
'use strict';

const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const PopupMenu = imports.ui.popupMenu;
const PanelMenu = imports.ui.panelMenu;
const Slider = imports.ui.slider;

const ExtensionSystem = imports.ui.extensionSystem;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Shaders = Me.imports.shaders;

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

let menu;


function init() {
}

function enable() {
    menu = new MenuButton();
    Main.panel.addToStatusArea("ColorBlindFilters", menu, 0, "right");
}

function disable() {
    menu.destroy();
    menu = null;
}


const MenuButton = GObject.registerClass ({
    GTypeName: 'CBMenuButton',}, class MenuButton extends PanelMenu.Button {
    _init() {
        super._init(0.5, 'ColorblindMenu', false);

        const schema = Me.metadata['settings-schema'];
        this._settings = ExtensionUtils.getSettings(schema);
        
        this._menuItems = [];

        const switchOff = new PopupMenu.PopupSwitchMenuItem('', false);
        switchOff.connect('toggled', () => {
            this._setShaderEffect();
            this._setPanelIcon();
        });
        this._switch = switchOff._switch;
        this._activeLabel = switchOff.label;

        this._menuItems = []
        this.menu.addMenuItem(switchOff);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const correctionsExpander = new PopupMenu.PopupSubMenuMenuItem(_('Color Blindness'));
        this.menu.addMenuItem(correctionsExpander);

        const strengthSlider = new Slider.Slider(0);
        const sliderMenuItem = new PopupMenu.PopupBaseMenuItem();
        sliderMenuItem._slider = true;
        const label =  new St.Label({text: _('Strength:')});
        sliderMenuItem.add_child(label);
        sliderMenuItem.add_child(strengthSlider);
        correctionsExpander.menu.addMenuItem(sliderMenuItem);
        this._strengthSlider = strengthSlider;

        correctionsExpander.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const protanItem = new PopupMenu.PopupMenuItem(_('Protanopia Correction'), false);
        protanItem.connect('activate', this._switchFilter.bind(this, protanItem));
        this._menuItems.push(protanItem);
        protanItem._filter = 0;
        protanItem._effect = Shaders.DaltonismEffect;
        const deuterItem = new PopupMenu.PopupMenuItem(_('Deuteranopia Correction'), false);
        deuterItem.connect('activate', this._switchFilter.bind(this, deuterItem));
        this._menuItems.push(deuterItem);
        deuterItem._filter = 1;
        deuterItem._effect = Shaders.DaltonismEffect;
        const tritanItem = new PopupMenu.PopupMenuItem(_('Tritanopia Correction'), false);
        tritanItem.connect('activate', this._switchFilter.bind(this, tritanItem));
        this._menuItems.push(tritanItem);
        tritanItem._filter = 2;
        tritanItem._effect = Shaders.DaltonismEffect;

        correctionsExpander.menu.addMenuItem(protanItem);
        correctionsExpander.menu.addMenuItem(deuterItem);
        correctionsExpander.menu.addMenuItem(tritanItem);
        correctionsExpander.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const protanSimulItem = new PopupMenu.PopupMenuItem(_('Protanopia Simulation'), false);
        protanSimulItem.connect('activate', this._switchFilter.bind(this, protanSimulItem));
        this._menuItems.push(protanSimulItem);
        protanSimulItem._filter = 3;
        protanSimulItem._effect = Shaders.DaltonismEffect;
        const deuterSimulItem = new PopupMenu.PopupMenuItem(_('Deuteranopia Simulation'), false);
        deuterSimulItem.connect('activate', this._switchFilter.bind(this, deuterSimulItem));
        this._menuItems.push(deuterSimulItem);
        deuterSimulItem._filter = 4;
        deuterSimulItem._effect = Shaders.DaltonismEffect;
        const tritanSimulItem = new PopupMenu.PopupMenuItem(_('Tritanopia Simulation'), false);
        tritanSimulItem.connect('activate', this._switchFilter.bind(this, tritanSimulItem));
        this._menuItems.push(tritanSimulItem);
        tritanSimulItem._filter = 5;
        tritanSimulItem._effect = Shaders.DaltonismEffect;

        correctionsExpander.menu.addMenuItem(protanSimulItem);
        correctionsExpander.menu.addMenuItem(deuterSimulItem);
        correctionsExpander.menu.addMenuItem(tritanSimulItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const othersExpander = new PopupMenu.PopupSubMenuMenuItem(_('Other Effects'));
        this.menu.addMenuItem(othersExpander);

        const gbrItem = new PopupMenu.PopupMenuItem(_('Channel Mixer - GBR'), false);
        gbrItem.connect('activate', this._switchFilter.bind(this, gbrItem));
        this._menuItems.push(gbrItem);
        gbrItem._filter = 8;
        gbrItem._effect = Shaders.ColorMixerGBREffect;
        othersExpander.menu.addMenuItem(gbrItem);

        const brgItem = new PopupMenu.PopupMenuItem(_('Channel Mixer - BRG'), false);
        brgItem.connect('activate', this._switchFilter.bind(this, brgItem));
        this._menuItems.push(brgItem);
        brgItem._filter = 9;
        brgItem._effect = Shaders.ColorMixerBRGEffect;
        othersExpander.menu.addMenuItem(brgItem);

        const lightnessInversionItem = new PopupMenu.PopupMenuItem(_('Lightness Inversion'), false);
        lightnessInversionItem.connect('activate', this._switchFilter.bind(this, lightnessInversionItem));
        this._menuItems.push(lightnessInversionItem);
        lightnessInversionItem._filter = 6;
        lightnessInversionItem._effect = Shaders.InvertLightnessEffect;
        othersExpander.menu.addMenuItem(lightnessInversionItem);

        const colorInversionItem = new PopupMenu.PopupMenuItem(_('Color Inversion'), false);
        colorInversionItem.connect('activate', this._switchFilter.bind(this, colorInversionItem));
        this._menuItems.push(colorInversionItem);
        colorInversionItem._filter = 7;
        colorInversionItem._effect = Shaders.ColorInversionEffect;
        othersExpander.menu.addMenuItem(colorInversionItem);

        this._loadSettings();
        this._setOrnament();
        this._setShaderEffect();
        this._setPanelIcon();

        strengthSlider.connect('notify::value', this._switchFilter.bind(this, strengthSlider));
    }

    _switchFilter(activeItem) {
        if (activeItem.value === undefined) {
            this._activeIndex = activeItem._filter;
            this._activeEffect = activeItem._effect;
            this._removeOrnament();
            this._setOrnament();
        } else {
            this._filterStrength = activeItem.value;
        }
        this._setShaderEffect();
    }

    _removeOrnament() {
        for (const item of this._menuItems) {
            item.setOrnament(false);
        }
    }

    _setOrnament() {
        for (const item of this._menuItems) {
            if (item._filter === this._activeIndex) {
                item.setOrnament(true);
                this._activeLabel.text = item.label.text;
                this._activeEffect = item._effect;
            }
        }
    }

    _setShaderEffect() {
        const name = 'color-blind';

        this._saveSettings();
        this._removeEffect(name);

        if (!this._switch.state) {
            return;
        }
        
        const filterIndex = this._activeIndex;
        const strength = this._filterStrength;
        
        let effect;
        if (filterIndex < 6) {
            effect = new Shaders.DaltonismEffect(filterIndex, strength);
        } else {
            effect = new this._activeEffect();
        }

        this._addEffect(name, effect);
    }

    _addEffect(name, effect) {
        if (Main.uiGroup.get_effect(name)) {
            Main.uiGroup.remove_effect_by_name(name);
        }

        Main.uiGroup.add_effect_with_name(name, effect);
    }

    _removeEffect(name) {
        if (Main.uiGroup.get_effect(name)) {
            Main.uiGroup.remove_effect_by_name(name);
        }
    }

    _saveSettings() {
        const settings = this._settings;
        settings.set_boolean('filter-active', this._switch.state);
        settings.set_int('filter-index', this._activeIndex);
        settings.set_int('filter-strength', Math.round(this._filterStrength * 100));
    }

    _loadSettings() {
        const settings = this._settings;
        this._activeIndex = settings.get_int('filter-index');
        this._filterStrength = settings.get_int('filter-strength') / 100;
        this._strengthSlider.value = this._filterStrength;
        this._switch.state = settings.get_boolean('filter-active');
    }

    vfunc_event(event) {
        if (!this.menu || event.type() !== Clutter.EventType.BUTTON_PRESS) {
            return Clutter.EVENT_PROPAGATE;
        }
        if (event.get_button() === Clutter.BUTTON_PRIMARY || event.get_button() === Clutter.BUTTON_MIDDLE) {
            this._switch.state = !this._switch.state;
            this._setShaderEffect();
            this._setPanelIcon();
        }
        else if (event.get_button() === Clutter.BUTTON_SECONDARY) {
            this.menu.toggle();
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _setPanelIcon() {
        if (this._icon) {
            this.remove_child(this._icon);
            this._icon.destroy();
            this._icon = null;
        }

        const gicon = Gio.icon_new_for_string(`${Me.path}/icons/eye-${this._switch.state ? '' : 'disabled-'}symbolic.svg`);
        const icon = new St.Icon({ gicon, icon_size: 20 });
        this.add_child(icon);
        this._icon = icon;
    }
});
