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
        this._getEffects();

        this._actionTime = Date.now();
        this._activeItem = null;
        this._activeData = null;
        this._filterStrength = 1;
        this._menuItems = [];

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


        const strengthSlider = new Slider.Slider(0);
        const sliderMenuItem = new PopupMenu.PopupBaseMenuItem();
        sliderMenuItem._slider = true;
        const label =  new St.Label({text: _('Strength:')});
        sliderMenuItem.add_child(label);
        sliderMenuItem.add_child(strengthSlider);
        this._strengthMenuItem = sliderMenuItem;
        this._strengthSlider = strengthSlider;

        const correctionsExpander = new PopupMenu.PopupSubMenuMenuItem(_('Color Blindness - Corrections'));
        this._correctionsExpander = correctionsExpander;

        const protanItem = new PopupMenu.PopupMenuItem(_('Protanopia Correction'), false);
        protanItem.connect('activate', this._switchFilter.bind(this, protanItem));
        protanItem._effect = this.Effects.ProtanCorrection;
        this._menuItems.push(protanItem);

        const protanTurboItem = new PopupMenu.PopupMenuItem(_('Protanopia High Contrast'), false);
        protanTurboItem.connect('activate', this._switchFilter.bind(this, protanTurboItem));
        protanTurboItem._effect = this.Effects.ProtanCorrectionHighContrast;
        this._menuItems.push(protanTurboItem);

        const deuterItem = new PopupMenu.PopupMenuItem(_('Deuteranopia Correction'), false);
        deuterItem.connect('activate', this._switchFilter.bind(this, deuterItem));
        this._menuItems.push(deuterItem);
        deuterItem._effect = this.Effects.DeuterCorrection;

        const deuterTurboItem = new PopupMenu.PopupMenuItem(_('Deuteranopia High Contrast'), false);
        deuterTurboItem.connect('activate', this._switchFilter.bind(this, deuterTurboItem));
        deuterTurboItem._effect = this.Effects.DeuterCorrectionHighContrast;
        this._menuItems.push(deuterTurboItem);

        const tritanItem = new PopupMenu.PopupMenuItem(_('Tritanopia Correction'), false);
        tritanItem.connect('activate', this._switchFilter.bind(this, tritanItem));
        tritanItem._effect = this.Effects.TritanCorrection;
        this._menuItems.push(tritanItem);


        const simulationsExpander = new PopupMenu.PopupSubMenuMenuItem(_('Color Blindness - Simulations'));

        const protanSimulItem = new PopupMenu.PopupMenuItem(_('Protanopia Simulation'), false);
        protanSimulItem.connect('activate', this._switchFilter.bind(this, protanSimulItem));
        protanSimulItem._effect = this.Effects.ProtanSimulation;
        this._menuItems.push(protanSimulItem);

        const deuterSimulItem = new PopupMenu.PopupMenuItem(_('Deuteranopia Simulation'), false);
        deuterSimulItem.connect('activate', this._switchFilter.bind(this, deuterSimulItem));
        deuterSimulItem._effect = this.Effects.DeuterSimulation;
        this._menuItems.push(deuterSimulItem);

        const tritanSimulItem = new PopupMenu.PopupMenuItem(_('Tritanopia Simulation'), false);
        tritanSimulItem.connect('activate', this._switchFilter.bind(this, tritanSimulItem));
        tritanSimulItem._effect = this.Effects.TritanSimulation;
        this._menuItems.push(tritanSimulItem);

        const otherExpander = new PopupMenu.PopupSubMenuMenuItem(_('Other Effects'));

        const gbrItem = new PopupMenu.PopupMenuItem(_('Channel Mixer - GBR'), false);
        gbrItem.connect('activate', this._switchFilter.bind(this, gbrItem));
        gbrItem._effect = this.Effects.ColorMixerGBR;
        this._menuItems.push(gbrItem);

        const brgItem = new PopupMenu.PopupMenuItem(_('Channel Mixer - BRG'), false);
        brgItem.connect('activate', this._switchFilter.bind(this, brgItem));
        brgItem._effect = this.Effects.ColorMixerBRG;
        this._menuItems.push(brgItem);

        const desaturateItem = new PopupMenu.PopupMenuItem(_('Desaturation'), false);
        desaturateItem.connect('activate', this._switchFilter.bind(this, desaturateItem));
        desaturateItem._effect = this.Effects.Desaturation;
        this._menuItems.push(desaturateItem);

        const lightnessInversionItem = new PopupMenu.PopupMenuItem(_('Lightness Inversion'), false);
        lightnessInversionItem.connect('activate', this._switchFilter.bind(this, lightnessInversionItem));
        lightnessInversionItem._effect = this.Effects.LigtnessInversion;
        this._menuItems.push(lightnessInversionItem);

        const colorInversionItem = new PopupMenu.PopupMenuItem(_('Color Inversion'), false);
        colorInversionItem.connect('activate', this._switchFilter.bind(this, colorInversionItem));
        this._menuItems.push(colorInversionItem);
        colorInversionItem._effect = this.Effects.ColorInversion;

        this.menu.addMenuItem(switchOff);
        this.menu.addMenuItem(sliderMenuItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        correctionsExpander.menu.addMenuItem(protanItem);
        correctionsExpander.menu.addMenuItem(protanTurboItem);
        correctionsExpander.menu.addMenuItem(deuterItem);
        correctionsExpander.menu.addMenuItem(deuterTurboItem);
        correctionsExpander.menu.addMenuItem(tritanItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(correctionsExpander);
        this.menu.addMenuItem(simulationsExpander);
        simulationsExpander.menu.addMenuItem(protanSimulItem);
        simulationsExpander.menu.addMenuItem(deuterSimulItem);
        simulationsExpander.menu.addMenuItem(tritanSimulItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(otherExpander);
        otherExpander.menu.addMenuItem(desaturateItem);
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
            this._activeItem = activeItem;
            this._activeData = activeItem._effect;
            this._setOrnament();
        } else {
            // activeItem is strength slider
            this._filterStrength = activeItem.value;
        }

        this._setShaderEffect();
    }

    _setOrnament() {
        for (const item of this._menuItems) {
            item.setOrnament(false);
        }

        const item = this._activeItem;
        const slider = this._strengthMenuItem;
        item.setOrnament(true);

        if (item._effect.sliderEnabled) {
            slider.visible = true;
        } else {
            slider.visible = false;
        }
        this._activeLabel.text = item.label.text;

    }

    _setShaderEffect() {
        const name = 'colorblind';
        this._saveSettings();
        this._setPanelIcon();
        this._setOrnament();

        this._removeEffect(name);

        if (!this._switch.state) {
            return;
        }

        const effectData = this._activeData;
        const properties = effectData.properties;
        if (properties.factor !== undefined) {
            properties.factor = this._filterStrength;
        }

        const effect = new effectData.effect(properties);
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
        settings.set_string('filter-name', this._activeData.name);
        settings.set_int('filter-strength', Math.round(this._filterStrength * 100));
    }

    _loadSettings() {
        const settings = this._settings;
        const effectName = settings.get_string('filter-name');
        const item = this._getItemByName(effectName);
        this._activeItem = item ? item : this._getItemByName('DeuterCorrection');
        this._activeData = item._effect;
        this._filterStrength = settings.get_int('filter-strength') / 100;
        this._strengthSlider.value = this._filterStrength;
        this._switch.state = settings.get_boolean('filter-active');
    }

    _getItemByName(name) {
        for (const item of this._menuItems) {
            if (item._effect.name === name) {
                return item;
            }
        }
    }

    vfunc_event(event) {
        if (event.type() === Clutter.EventType.BUTTON_RELEASE)
            return Clutter.EVENT_PROPAGATE;

        // scrolling over panel btn switches between all cb correction filters except inversions
        if (this._switch.state && event.type() === Clutter.EventType.SCROLL && (Date.now() - this._actionTime) > 200) {
            const direction = event.get_scroll_direction();

            if (direction === Clutter.ScrollDirection.SMOOTH) {
                return Clutter.EVENT_STOP;
            }

            const step = direction === Clutter.ScrollDirection.UP ? 10 : 1;
            const index = (this._menuItems.indexOf(this._activeItem) + step) % 11;
            const item = this._menuItems[index];
            this._switchFilter(item);
            this._actionTime = Date.now();
            this._setPanelLabel(item);

            return Clutter.EVENT_STOP;
        }

        if (event.type() === Clutter.EventType.BUTTON_PRESS && (event.get_button() === Clutter.BUTTON_PRIMARY || event.get_button() === Clutter.BUTTON_MIDDLE)) {
            // primary button toggles active filter on/off
            if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                this._switch.state = !this._switch.state;
                this._setShaderEffect();
                return Clutter.EVENT_STOP;

            } else if (this._switch.state && event.get_button() === Clutter.BUTTON_MIDDLE) {
                // middle clicking on panel btn switches between normal correction, high contrast and off state for the active cb type
                let index = this._menuItems.indexOf(this._activeItem);
                const effectName = this._activeData.name;
                if (effectName == 'ProtanCorrection' || effectName == 'DeuterCorrection') {
                    index += 1;
                } else if (effectName == 'ProtanCorrectionHighContrast' || effectName == 'DeuterCorrectionHighContrast') {
                    index -= 1;
                }

                this._activeItem = this._menuItems[index];

                this._setPanelLabel();
                this._setShaderEffect();
                return Clutter.EVENT_STOP;
            }

        } else if (event.type() === Clutter.EventType.TOUCH_BEGIN || (event.type() === Clutter.EventType.BUTTON_PRESS && event.get_button() === Clutter.BUTTON_SECONDARY)) {
            this.menu.toggle();
            this._correctionsExpander.setSubmenuShown(true);
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _setPanelLabel(item) {
        if (!item) {
            item = this._activeItem;
        }

        if (this._switch.state) {
            this._panelLabel.text = this._activeData.shortName;
            this._panelBin.set_style('spacing: 3px;');
            this._resetLabelTimeout();
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

    _getEffects() {
        this.Effects = {
            ProtanCorrection: {
                name: 'ProtanCorrection',
                shortName: 'PC',
                properties: {
                    mode: 0,
                    factor: 1
                },
                effect: Shaders.DaltonismEffect,
                sliderEnabled: true
            },

            ProtanCorrectionHighContrast: {
                name: 'ProtanCorrectionHighContrast',
                shortName: 'PH',
                properties: {
                    mode: 1,
                    factor: 1
                },
                effect: Shaders.DaltonismEffect,
                sliderEnabled: true
            },

            DeuterCorrection: {
                name: 'DeuterCorrection',
                shortName: 'DC',
                properties: {
                    mode: 2,
                    factor: 1
                },
                effect: Shaders.DaltonismEffect,
                sliderEnabled: true
            },

            DeuterCorrectionHighContrast: {
                name: 'DeuterCorrectionHighContrast',
                shortName: 'DH',
                properties: {
                    mode: 3,
                    factor: 1
                },
                effect: Shaders.DaltonismEffect,
                sliderEnabled: true
            },

            TritanCorrection: {
                name: 'TritanCorrection',
                shortName: 'TC',
                properties: {
                    mode: 4,
                    factor: 1
                },
                effect: Shaders.DaltonismEffect,
                sliderEnabled: true
            },

            ProtanSimulation: {
                name: 'ProtanSimulation',
                shortName: 'PS',
                properties: {
                    mode: 5,
                    factor: 1
                },
                effect: Shaders.DaltonismEffect,
                sliderEnabled: true
            },

            DeuterSimulation: {
                name: 'DeuterSimulation',
                shortName: 'DS',
                properties: {
                    mode: 6,
                    factor: 1
                },
                effect: Shaders.DaltonismEffect,
                sliderEnabled: true
            },

            TritanSimulation: {
                name: 'TritanSimulation',
                shortName: 'TS',
                properties: {
                    mode: 7,
                    factor: 1
                },
                effect: Shaders.DaltonismEffect,
                sliderEnabled: true
            },

            ColorMixerGBR: {
                name: 'ColorMixerGBR',
                shortName: 'GBR',
                properties: {
                    mode: 0,
                    factor: 1,
                },
                effect: Shaders.ColorMixerEffect,
                sliderEnabled: true
            },

            ColorMixerBRG: {
                name: 'ColorMixerBRG',
                shortName: 'BRG',
                properties: {
                    mode: 1,
                    factor: 1
                },
                effect: Shaders.ColorMixerEffect,
                sliderEnabled: true
            },

            Desaturation: {
                name: 'Desaturation',
                shortName: 'D',
                properties: {
                    factor: 1
                },
                effect: Shaders.DesaturateEffect,
                sliderEnabled: true
            },

            LigtnessInversion: {
                name: 'LightnessInversion',
                shortName: 'LI',
                properties: {
                    mode: 0
                },
                effect: Shaders.InversionEffect,
                sliderEnabled: false
            },

            ColorInversion: {
                name: 'ColorInversion',
                shortName: 'CI',
                properties: {
                    mode: 2
                },
                effect: Shaders.InversionEffect,
                sliderEnabled: false
            },
        }
    }
});
