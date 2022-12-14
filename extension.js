/**
 * ColorBlind Filters
 * extension.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2022
 * @license    GPL-3.0
 */
'use strict';

const { Gio, GLib, GObject, St, Clutter } = imports.gi;

const Main = imports.ui.main;
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
    if (menu._labelTimeoutId)
        GLib.source_remove(menu._labelTimeoutId);

    menu.destroy();
    menu = null;
}


const MenuButton = GObject.registerClass ({
    GTypeName: 'CBMenuButton',}, class MenuButton extends PanelMenu.Button {
    _init() {
        super._init(0.5, 'ColorblindMenu', false);

        const schema = Me.metadata['settings-schema'];
        this._settings = ExtensionUtils.getSettings(schema);
        this._actionTime = Date.now();

        const bin = new St.BoxLayout();
        const panelLabel = new St.Label({ y_align: Clutter.ActorAlign.CENTER });

        bin.add_child(panelLabel);
        this.add_child(bin);

        this._panelLabel = panelLabel;
        this._panelBin = bin;

        this._menuItems = [];

        const switchOff = new PopupMenu.PopupSwitchMenuItem('', false);
        switchOff.connect('toggled', () => {
            this._setShaderEffect();
        });
        this._switch = switchOff._switch;
        this._activeLabel = switchOff.label;

        this._menuItems = []

        const strengthSlider = new Slider.Slider(0);
        const sliderMenuItem = new PopupMenu.PopupBaseMenuItem();
        sliderMenuItem._slider = true;
        const label =  new St.Label({text: _('Strength:')});
        sliderMenuItem.add_child(label);
        sliderMenuItem.add_child(strengthSlider);
        this._strengthMenuItem = sliderMenuItem;
        this._strengthSlider = strengthSlider;

        const protanItem = new PopupMenu.PopupMenuItem(_('Protanopia Correction'), false);
        protanItem.connect('activate', this._switchFilter.bind(this, protanItem));
        this._menuItems.push(protanItem);
        protanItem._filterIndex = 0;

        const protanTurboItem = new PopupMenu.PopupMenuItem(_('Protanopia High Contrast'), false);
        protanTurboItem.connect('activate', this._switchFilter.bind(this, protanTurboItem));
        this._menuItems.push(protanTurboItem);
        protanTurboItem._filterIndex = 1;

        const deuterItem = new PopupMenu.PopupMenuItem(_('Deuteranopia Correction'), false);
        deuterItem.connect('activate', this._switchFilter.bind(this, deuterItem));
        this._menuItems.push(deuterItem);
        deuterItem._filterIndex = 2;

        const deuterTurboItem = new PopupMenu.PopupMenuItem(_('Deuteranopia High Contrast'), false);
        deuterTurboItem.connect('activate', this._switchFilter.bind(this, deuterTurboItem));
        this._menuItems.push(deuterTurboItem);
        deuterTurboItem._filterIndex = 3;

        const tritanItem = new PopupMenu.PopupMenuItem(_('Tritanopia Correction'), false);
        tritanItem.connect('activate', this._switchFilter.bind(this, tritanItem));
        this._menuItems.push(tritanItem);
        tritanItem._filterIndex = 4;


        const simulationsExpander = new PopupMenu.PopupSubMenuMenuItem(_('Color Blindness Simulations'));

        const protanSimulItem = new PopupMenu.PopupMenuItem(_('Protanopia Simulation'), false);
        protanSimulItem.connect('activate', this._switchFilter.bind(this, protanSimulItem));
        this._menuItems.push(protanSimulItem);
        protanSimulItem._filterIndex = 5;

        const deuterSimulItem = new PopupMenu.PopupMenuItem(_('Deuteranopia Simulation'), false);
        deuterSimulItem.connect('activate', this._switchFilter.bind(this, deuterSimulItem));
        this._menuItems.push(deuterSimulItem);
        deuterSimulItem._filterIndex = 6;

        const tritanSimulItem = new PopupMenu.PopupMenuItem(_('Tritanopia Simulation'), false);
        tritanSimulItem.connect('activate', this._switchFilter.bind(this, tritanSimulItem));
        this._menuItems.push(tritanSimulItem);
        tritanSimulItem._filterIndex = 7;

        const otherExpander = new PopupMenu.PopupSubMenuMenuItem(_('Other Effects'));

        const gbrItem = new PopupMenu.PopupMenuItem(_('Channel Mixer - GBR'), false);
        gbrItem.connect('activate', this._switchFilter.bind(this, gbrItem));
        this._menuItems.push(gbrItem);
        gbrItem._filterIndex = 8;
        gbrItem._effect = Shaders.ColorMixerEffect;
        gbrItem._properties = { mode: 1 };

        const brgItem = new PopupMenu.PopupMenuItem(_('Channel Mixer - BRG'), false);
        brgItem.connect('activate', this._switchFilter.bind(this, brgItem));
        this._menuItems.push(brgItem);
        brgItem._filterIndex = 9;
        brgItem._effect = Shaders.ColorMixerEffect;
        brgItem._properties = { mode: 2 };

        const lightnessInversionItem = new PopupMenu.PopupMenuItem(_('Lightness Inversion'), false);
        lightnessInversionItem.connect('activate', this._switchFilter.bind(this, lightnessInversionItem));
        this._menuItems.push(lightnessInversionItem);
        lightnessInversionItem._filterIndex = 10;
        lightnessInversionItem._effect = Shaders.InversionEffect;
        lightnessInversionItem._properties = { mode: 0 };

        const colorInversionItem = new PopupMenu.PopupMenuItem(_('Color Inversion'), false);
        colorInversionItem.connect('activate', this._switchFilter.bind(this, colorInversionItem));
        this._menuItems.push(colorInversionItem);
        colorInversionItem._filterIndex = 11;
        colorInversionItem._effect = Shaders.InversionEffect;
        colorInversionItem._properties = { mode: 2 };

        this.menu.addMenuItem(switchOff);
        this.menu.addMenuItem(sliderMenuItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(protanItem);
        this.menu.addMenuItem(protanTurboItem);
        this.menu.addMenuItem(deuterItem);
        this.menu.addMenuItem(deuterTurboItem);
        this.menu.addMenuItem(tritanItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(simulationsExpander);
        simulationsExpander.menu.addMenuItem(protanSimulItem);
        simulationsExpander.menu.addMenuItem(deuterSimulItem);
        simulationsExpander.menu.addMenuItem(tritanSimulItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(otherExpander);
        otherExpander.menu.addMenuItem(gbrItem);
        otherExpander.menu.addMenuItem(brgItem);
        otherExpander.menu.addMenuItem(lightnessInversionItem);
        otherExpander.menu.addMenuItem(colorInversionItem);

        this._loadSettings();
        this._setShaderEffect();

        strengthSlider.connect('notify::value', this._switchFilter.bind(this, strengthSlider));
    }

    _switchFilter(activeItem) {
        if (activeItem.value === undefined) {
            // active item is filter
            this._activeIndex = activeItem._filterIndex;
            this._activeEffect = activeItem._effect;
            this._setOrnament();
        } else {
            // activeItem is strength slider
            this._filterStrength = activeItem.value;
        }

        this._setShaderEffect();
    }

    _setOrnament() {
        for (const item of this._menuItems) {
            if (item._filterIndex === this._activeIndex) {
                item.setOrnament(true);
                this._activeLabel.text = item.label.text;
                this._activeEffect = item._effect;
                if (this._activeIndex > 7) {
                    this._strengthMenuItem.visible = false;
                } else {
                    this._strengthMenuItem.visible = true;
                }
            } else {
                item.setOrnament(false);
            }
        }
    }

    _setShaderEffect() {
        const name = 'colorblind';

        this._saveSettings();
        this._removeEffect(name);

        this._setPanelIcon();
        this._setOrnament();

        if (!this._switch.state) {
            return;
        }

        const filterIndex = this._activeIndex;
        const strength = this._filterStrength;

        let effect;
        if (filterIndex < 8) {
            effect = new Shaders.DaltonismEffect(filterIndex, strength);
        } else {
            const properties = this._menuItems[this._activeIndex]._properties;
            effect = new this._activeEffect(properties);
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
        if (event.type() === Clutter.EventType.BUTTON_RELEASE)
            return Clutter.EVENT_PROPAGATE;

        // scrolling over panel btn switches between all cb correction filters
        if (this._switch.state && event.type() === Clutter.EventType.SCROLL && (Date.now() - this._actionTime) > 200) {
            const direction = event.get_scroll_direction();

            if (direction === Clutter.ScrollDirection.SMOOTH) {
                return Clutter.EVENT_STOP;
            }

            const step = direction === Clutter.ScrollDirection.UP ? 11 : 1;
            const index = (this._activeIndex + step) % 12;
            const item = this._menuItems[index];
            this._switchFilter(item);
            this._actionTime = Date.now();
            this._setPanelLabel(item);

            return Clutter.EVENT_STOP;
        }

        if (event.type() === Clutter.EventType.BUTTON_PRESS && (event.get_button() === Clutter.BUTTON_PRIMARY || event.get_button() === Clutter.BUTTON_MIDDLE)) {

            if (this._activeIndex > 4) {
                this._switch.state = !this._switch.state;
                this._setShaderEffect();
                return Clutter.EVENT_STOP;
            }
            // left clicking on panel btn switches between normal correction, high contrast and off state for given cb type
            let index = this._switch.state ? this._activeIndex : -1;
            switch (index) {
                case -1: index = this._activeIndex;
                        break;
                case 0: index = 1;
                        break;
                case 1: index = -1;
                        break;
                case 2: index = 3;
                        break;
                case 3: index = -2;
                        break;
                case 4: index = -3;
                        break;
            }
            if (index < 0) {
                this._switch.state = false;
                if (index == -1) {
                    this._activeIndex = 0;
                } else if (index == -2) {
                    this._activeIndex = 2;
                }
                this._setPanelIcon();
            } else {
                this._activeIndex = index;
                this._switch.state = true;
            }

            this._setPanelLabel();
            this._setShaderEffect();
            return Clutter.EVENT_STOP;

        } else if (event.type() === Clutter.EventType.TOUCH_BEGIN || (event.type() === Clutter.EventType.BUTTON_PRESS && event.get_button() === Clutter.BUTTON_SECONDARY)) {
            this.menu.toggle();
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _setPanelLabel(item) {
        if (!item) {
            item = this._menuItems[this._activeIndex];
        }

        if (this._switch.state) {
            const words = item.label.text.split(' ');
            this._panelLabel.text = words[0][0] + words[1][0];
            this._panelBin.set_style('spacing: 3px;');
            this._resetLabelTimeout();
            //this._icon.visible = false;
        } else {
            this._panelBin.set_style('spacing: 0;');
            this._panelLabel.text = '';
        }
    }

    _setPanelIcon() {
        if (this._icon) {
            this._panelBin.remove_child(this._icon);
            this._icon.destroy();
            this._icon = null;
        }

        const gicon = Gio.icon_new_for_string(`${Me.path}/icons/eye-${this._switch.state ? '' : 'disabled-'}symbolic.svg`);
        const icon = new St.Icon({ gicon, icon_size: 20 });

        this._panelBin.add_child(icon);
        this._icon = icon;
    }

    _resetLabelTimeout() {
        if (this._labelTimeoutId) {
            GLib.source_remove(this._labelTimeoutId);
        }

        this._labelTimeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            2,
            () => {
                this._panelLabel.text = '';
                this._panelBin.set_style('spacing: 0;');
                this._icon.visible = true;
                this._labelTimeoutId = 0;
                return GLib.SOURCE_REMOVE;
            }
        );
    }
});
