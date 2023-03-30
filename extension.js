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
const PANEL_ICON_SIZE = imports.ui.panel.PANEL_ICON_SIZE + 2;

const ExtensionSystem = imports.ui.extensionSystem;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Shaders = Me.imports.shaders;

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

let menu;


function init() {
    ExtensionUtils.initTranslations();
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
        this._filterName = 'colorblind';
        this._getEffects();

        this._actionTime = 0;
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
            this._switchToggled();
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

        const desaturateItem = new PopupMenu.PopupMenuItem(_('Desaturation'), false);
        desaturateItem.connect('activate', this._switchFilter.bind(this, desaturateItem));
        desaturateItem._effect = this.Effects.Desaturation;
        this._menuItems.push(desaturateItem);

        const gbrItem = new PopupMenu.PopupMenuItem(_('Channel Mixer - GBR'), false);
        gbrItem.connect('activate', this._switchFilter.bind(this, gbrItem));
        gbrItem._effect = this.Effects.ColorMixerGBR;
        this._menuItems.push(gbrItem);

        const brgItem = new PopupMenu.PopupMenuItem(_('Channel Mixer - BRG'), false);
        brgItem.connect('activate', this._switchFilter.bind(this, brgItem));
        brgItem._effect = this.Effects.ColorMixerBRG;
        this._menuItems.push(brgItem);

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
        this.connect('destroy', ()=> {
            this._removeEffect();
            this._activeEffect = null;
            this._clearEffects();

            if (this._labelTimeoutId) {
                GLib.source_remove(this._labelTimeoutId);
            }
            if (this._delayedSaveId) {
                GLib.source_remove(this._delayedSaveId);
                this._delayedSaveId = 0;
            }
            this._settings = null;
        });
    }

    _switchToggled() {
        if (this._switch.state) {
            if (this._activeEffect) {
                this._addEffect(this._activeEffect);
            } else {
                this._setShaderEffect();
            }
        } else {
            this._removeEffect();
        }
        this._setPanelIcon();
        this._saveSettings();
    }

    _switchFilter(activeItem) {
        this._saveSettings();
        this._setPanelIcon();
        this._setOrnament();

        if (activeItem.value === undefined) {
            // active item is filter
            const sameShader = activeItem._effect.effect == this._activeData.effect;
            this._activeItem = activeItem;
            this._activeData = activeItem._effect;
            if (sameShader) {
                this._updateEffect();
            } else {
                this._setShaderEffect();
            }
        } else {
            // activeItem is strength slider
            // for some reason 0 and 1 don't update the shader
            // Math.Clamp is not supported in older versions og gjs
            // this._filterStrength = Math.clamp(0.001, activeItem.value, 0.999);
            this._filterStrength = activeItem.value;
            if (this._filterStrength === 0)
                this._filterStrength += 0.001;
            else if (this._filterStrength === 1)
                this._filterStrength -= 0.001;
            this._updateEffect();
        }
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

    _updateEffect() {
        this._updateExtension();
        const properties = this._getProperties();
        this._activeEffect.updateEffect(properties);
    }

    _getProperties() {
        const effectData = this._activeData;
        const properties = effectData.properties;
        if (properties.factor !== undefined) {
            properties.factor = this._filterStrength;
        }
        return properties;
    }

    _updateExtension() {
        this._setPanelIcon();
        this._setOrnament();
    }

    _setShaderEffect() {
        this._removeEffect();
        this._updateExtension();

        if (!this._switch.state) {
            return;
        }

        const properties = this._getProperties();

        const effectData = this._activeData;
        const effect = effectData.effect(properties);
        this._addEffect(effect);
    }

    _addEffect(effect) {
        Main.uiGroup.add_effect_with_name(this._filterName, effect);
        this._activeEffect = effect;
    }

    _removeEffect() {
        Main.uiGroup.remove_effect_by_name(this._filterName);
    }

    _saveSettings() {
        // avoid unnecessary disk usage
        if (this._delayedSaveId) {
            GLib.source_remove(this._delayedSaveId);
        }

        this._delayedSaveId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            200,
            () => {
                const settings = this._settings;
                settings.set_boolean('filter-active', this._switch.state);
                settings.set_string('filter-name', this._activeData.name);
                settings.set_int('filter-strength', Math.round(this._filterStrength * 100));
                if (this._switch.state) {
                    // re-enabling the effect updates the whole screen immediately, otherwise it can flicker / partially apply on some portions of the screen
                    // but for a price of significant memory use (same as remove/add), which is often NOT released by the garbage collector
                    //this._activeEffect.set_enabled(false);
                    //this._activeEffect.set_enabled(true);
                }
                this._delayedSaveId = 0;
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    _loadSettings() {
        const settings = this._settings;
        const effectName = settings.get_string('filter-name');
        const item = this._getItemByName(effectName);
        this._activeItem = item ? item : this._getItemByName('DeuterCorrection');
        this._activeData = item._effect;
        this._filterStrength = settings.get_int('filter-strength') / 100;
        // for some reason 0 and 1 don't update the shader
        // Math.Clamp is not supported in older versions og gjs
        //this._filterStrength = Math.clamp(0.01, this._filterStrength, 0.99);
        if (this._filterStrength === 0)
            this._filterStrength += 0.001;
        else if (this._filterStrength === 1)
            this._filterStrength -= 0.001;
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
            this._setPanelLabel(item);

            return Clutter.EVENT_STOP;
        }

        if (event.type() === Clutter.EventType.BUTTON_PRESS && (event.get_button() === Clutter.BUTTON_PRIMARY || event.get_button() === Clutter.BUTTON_MIDDLE)) {
            // primary button toggles active filter on/off
            if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                this._switch.state = !this._switch.state;
                //this._setShaderEffect();
                this._switchToggled();
                return Clutter.EVENT_STOP;

            } else if (this._switch.state && event.get_button() === Clutter.BUTTON_MIDDLE) {
                // middle clicking on panel btn switches between normal correction, high contrast and off state for the active cb type
                let item;
                const effectName = this._activeData.name;

                switch (effectName) {
                    case 'ProtanCorrection':
                        item = this._getItemByName('ProtanCorrectionHighContrast');
                        break;
                    case 'ProtanCorrectionHighContrast':
                        item = this._getItemByName('ProtanCorrection');
                        break;
                    case 'DeuterCorrection':
                        item = this._getItemByName('DeuterCorrectionHighContrast');
                        break;
                    case 'DeuterCorrectionHighContrast':
                        item = this._getItemByName('DeuterCorrection');
                        break;
                }

                if (item) {
                    this._switchFilter(item);
                }

                this._setPanelLabel();
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

        const gicon = Gio.icon_new_for_string(`view-${this._switch.state ? 'reveal' : 'conceal'}-symbolic`);
        const icon = new St.Icon({ gicon, icon_size: PANEL_ICON_SIZE });

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

    _getDaltonismEffect(properties) {
        if (!this._daltonismEffect) {
            this._daltonismEffect = new Shaders.DaltonismEffect(properties);
        } else {
            this._daltonismEffect.updateEffect(properties);
        }

        return this._daltonismEffect;
    }

    _getChannelMixerEffect(properties) {
        if (!this._channelMixerEffect) {
            this._channelMixerEffect = new Shaders.ColorMixerEffect(properties);
        } else {
            this._channelMixerEffect.updateEffect(properties);
        }

        return this._channelMixerEffect;
    }

    _getDesaturateEffect(properties) {
        if (!this._desaturateEffect) {
            this._desaturateEffect = new Shaders.DesaturateEffect(properties);
        } else {
            this._desaturateEffect.updateEffect(properties);
        }

        return this._desaturateEffect;
    }

    _getInversionEffect(properties) {
        if (!this._inversionEffect) {
            this._inversionEffect = new Shaders.InversionEffect(properties);
        } else {
            this._inversionEffect.updateEffect(properties);
        }

        return this._inversionEffect;
    }

    _clearEffects() {
        this._daltonismEffect = null;
        this._channelMixerEffect = null;
        this._desaturateEffect = null;
        this._inversionEffect = null;
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
                effect: this._getDaltonismEffect,
                sliderEnabled: true
            },

            ProtanCorrectionHighContrast: {
                name: 'ProtanCorrectionHighContrast',
                shortName: 'PH',
                properties: {
                    mode: 1,
                    factor: 1
                },
                effect: this._getDaltonismEffect,
                sliderEnabled: true
            },

            DeuterCorrection: {
                name: 'DeuterCorrection',
                shortName: 'DC',
                properties: {
                    mode: 2,
                    factor: 1
                },
                effect: this._getDaltonismEffect,
                sliderEnabled: true
            },

            DeuterCorrectionHighContrast: {
                name: 'DeuterCorrectionHighContrast',
                shortName: 'DH',
                properties: {
                    mode: 3,
                    factor: 1
                },
                effect: this._getDaltonismEffect,
                sliderEnabled: true
            },

            TritanCorrection: {
                name: 'TritanCorrection',
                shortName: 'TC',
                properties: {
                    mode: 4,
                    factor: 1
                },
                effect: this._getDaltonismEffect,
                sliderEnabled: true
            },

            ProtanSimulation: {
                name: 'ProtanSimulation',
                shortName: 'PS',
                properties: {
                    mode: 5,
                    factor: 1
                },
                effect: this._getDaltonismEffect,
                sliderEnabled: true
            },

            DeuterSimulation: {
                name: 'DeuterSimulation',
                shortName: 'DS',
                properties: {
                    mode: 6,
                    factor: 1
                },
                effect: this._getDaltonismEffect,
                sliderEnabled: true
            },

            TritanSimulation: {
                name: 'TritanSimulation',
                shortName: 'TS',
                properties: {
                    mode: 7,
                    factor: 1
                },
                effect: this._getDaltonismEffect,
                sliderEnabled: true
            },

            ColorMixerGBR: {
                name: 'ColorMixerGBR',
                shortName: 'GBR',
                properties: {
                    mode: 0,
                    factor: 1,
                },
                effect: this._getChannelMixerEffect,
                sliderEnabled: true
            },

            ColorMixerBRG: {
                name: 'ColorMixerBRG',
                shortName: 'BRG',
                properties: {
                    mode: 1,
                    factor: 1
                },
                effect: this._getChannelMixerEffect,
                sliderEnabled: true
            },

            Desaturation: {
                name: 'Desaturation',
                shortName: 'D',
                properties: {
                    factor: 1
                },
                effect: this._getDesaturateEffect,
                sliderEnabled: true
            },

            LigtnessInversion: {
                name: 'LightnessInversion',
                shortName: 'LI',
                properties: {
                    mode: 0
                },
                effect: this._getInversionEffect,
                sliderEnabled: false
            },

            ColorInversion: {
                name: 'ColorInversion',
                shortName: 'CI',
                properties: {
                    mode: 2
                },
                effect: this._getInversionEffect,
                sliderEnabled: false
            },
        }
    }
});
