/**
 * ColorBlind Filters
 * Shaders
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2022
 * @license    GPL-3.0
 */

'use strict';

const { GObject, Clutter } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;

var   DesaturateEffect = GObject.registerClass(
class DesaturateEffect extends Clutter.DesaturateEffect {
    _init(properties) {
        super._init(properties);
    }

    updateEffect(properties) {
        this.factor = properties.factor;
    }
});

var   InversionEffect = GObject.registerClass(
class InversionEffect extends Clutter.ShaderEffect {
    _init(properties) {
        super._init();
        this.updateEffect(properties);

        this._source = ShaderLib.getInversion();
        this.set_shader_source(this._source);
    }

    updateEffect(properties) {
        this._mode = properties.mode;
        return;
    }

    vfunc_get_static_shader_source() {
        return this._source;
    }

    vfunc_paint_target(node, paint_context) {
        this.set_uniform_value('tex', 0);
        this.set_uniform_value('INVERSION_MODE', this._mode);
        if (paint_context === undefined)
            super.vfunc_paint_target(node);
        else
            super.vfunc_paint_target(node, paint_context);
    }
});

var   ColorMixerEffect = GObject.registerClass(
class ColorMixerEffect extends Clutter.ShaderEffect {
    _init(properties) {
        super._init();
        // 0 - GRB, 1 - BRG
        this.updateEffect(properties);

        this._source = ShaderLib.getChannelMix();
        this.set_shader_source(this._source);
    }

    updateEffect(properties) {
        this._mode = properties.mode;
        this._strength = properties.factor;
    }

    vfunc_get_static_shader_source() {
        return this._source;
    }

    vfunc_paint_target(node, paint_context) {
        this.set_uniform_value('tex', 0);
        this.set_uniform_value('MIX_MODE', this._mode);
        this.set_uniform_value('STRENGTH', this._strength);
        if (paint_context === undefined)
            super.vfunc_paint_target(node);
        else
            super.vfunc_paint_target(node, paint_context);
    }
});

var   DaltonismEffect = GObject.registerClass(
class DaltonismEffect extends Clutter.ShaderEffect {
    _init(properties) {
        super._init();

        this.updateEffect(properties);

        this._source = ShaderLib.getDaltonism()
        this.set_shader_source(this._source);
    }

    updateEffect(properties) {
        this._mode = properties.mode;
        this._strength = properties.factor;
    }

    vfunc_get_static_shader_source() {
        return this._source;
    }

    vfunc_paint_target(node, paint_context) {
        this.set_uniform_value('tex', 0);
        this.set_uniform_value('COLORBLIND_MODE', this._mode);
        this.set_uniform_value('STRENGTH', this._strength);
        if (paint_context === undefined)
            super.vfunc_paint_target(node);
        else
            super.vfunc_paint_target(node, paint_context);
    }
});

var ShaderLib = class {
    constructor() {
    }

    static getDaltonism() {
        return `
            uniform sampler2D tex;
            uniform float STRENGTH;
            uniform int COLORBLIND_MODE;

            void main() {
                vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);

                // RGB to LMS matrix
                float L = (17.8824f * c.r) + (43.5161f * c.g) + (4.11935f * c.b);
                float M = (3.45565f * c.r) + (27.1554f * c.g) + (3.86714f * c.b);
                float S = (0.0299566f * c.r) + (0.184309f * c.g) + (1.46709f * c.b);

                float l;
                float m;
                float s;

                // Remove invisible colors
                if ( COLORBLIND_MODE == 0 || COLORBLIND_MODE == 1 || COLORBLIND_MODE == 5 ) { // Protanopia - reds are greatly reduced
                    l = 0.0f * L + 2.02344f * M + -2.52581f * S;
                    m = 0.0f * L + 1.0f * M + 0.0f * S;
                    s = 0.0f * L + 0.0f * M + 1.0f * S;
                } else if ( COLORBLIND_MODE == 2 || COLORBLIND_MODE == 3 || COLORBLIND_MODE == 6) {// Deuteranopia - greens are greatly reduced
                    l = 1.0f * L + 0.0f * M + 0.0f * S;
                    m = 0.494207f * L + 0.0f * M + 1.24827f * S;
                    s = 0.0f * L + 0.0f * M + 1.0f * S;
                } else if ( COLORBLIND_MODE == 4 || COLORBLIND_MODE == 7) {// Tritanopia - blues are greatly reduced (1 of 10 000)
                    l = 1.0f * L + 0.0f * M + 0.0f * S;
                    m = 0.0f * L + 1.0f * M + 0.0f * S;
                    // GdH - trinatopia vector calculated by me, all public sources were off
                    s = -0.012491378299329402f * L + 0.07203451899279534f * M + 0.0f * S;
                }

                // LMS to RGB matrix conversion
                vec4 error;
                error.r = (0.0809444479f * l) + (-0.130504409f * m) + (0.116721066f * s);
                error.g = (-0.0102485335f * l) + (0.0540193266f * m) + (-0.113614708f * s);
                error.b = (-0.000365296938f * l) + (-0.00412161469f * m) + (0.693511405f * s);

                // ratio between original and error colors allows adjusting filter for weaker forms of dichromacy
                error = error * STRENGTH + c * (1 - STRENGTH);
                error.a = 1;

                // The error is what they see
                if (COLORBLIND_MODE > 4) {
                    error.a = c.a;
                    cogl_color_out = error.rgba;
                    return;
                } else {
                    // Isolate invisible colors to color vision deficiency (calculate error matrix)
                    error = (c - error);

                    // Shift colors
                    vec4 correction;
                    // protanopia / protanomaly corrections (kwin effect values)
                    if ( COLORBLIND_MODE == 0 ) {
                        correction.r = error.r * 0.56667 + error.g * 0.43333 + error.b * 0.00000;
                        correction.g = error.r * 0.55833 + error.g * 0.44267 + error.b * 0.00000;
                        correction.b = error.r * 0.00000 + error.g * 0.24167 + error.b * 0.75833;

                    // protanopia / protanomaly high contrast G-R corrections
                    } else if ( COLORBLIND_MODE == 1 ) {
                        correction.r = error.r * 2.56667 + error.g * 0.43333 + error.b * 0.00000;
                        correction.g = error.r * 1.55833 + error.g * 0.44267 + error.b * 0.00000;
                        correction.b = error.r * 0.00000 + error.g * 0.24167 + error.b * 0.75833;

                    // deuteranopia / deuteranomaly corrections (tries to mimic Android, GdH)
                    } else if ( COLORBLIND_MODE == 2 ) {
                        correction.r = error.r * -0.7 + error.g * 0.0 + error.b * 0.0;
                        correction.g = error.r *  0.5 + error.g * 1.0 + error.b * 0.0;
                        correction.b = error.r * -0.3 + error.g * 0.0 + error.b * 1.0;

                    // deuteranopia / deuteranomaly high contrast R-G corrections
                    } else if ( COLORBLIND_MODE == 3 ) {
                        correction.r = error.r * -1.5 + error.g * 1.5 + error.b * 0.0;
                        correction.g = error.r * -1.5 + error.g * 1.5 + error.b * 0.0;
                        correction.b = error.r * 1.5 + error.g * 0.0 + error.b * 0.0;

                    // tritanopia / tritanomaly corrections (GdH)
                    } else if ( COLORBLIND_MODE == 4 ) {
                        correction.r = error.r * 0.3 + error.g * 0.5 + error.b * 0.4;
                        correction.g = error.r * 0.5 + error.g * 0.7 + error.b * 0.3;
                        correction.b = error.r * 0.0 + error.g * 0.0 + error.b * 1.0;
                    }

                    // Add compensation to original values
                    correction = c + correction;
                    correction.a = c.a;
                    cogl_color_out = correction.rgba;
                }
            }
        `;
    }

    static getChannelMix() {
        return `
            uniform sampler2D tex;
            uniform int MIX_MODE;
            uniform float STRENGTH;
            void main() {
                vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);
                vec4 m;
                if (MIX_MODE == 0) {
                    m = vec4(c.b, c.r, c.g, c.a);
                } else if (MIX_MODE == 1) {
                    m = vec4(c.g, c.b, c.r, c.a);
                }
                c = m * STRENGTH + c * (1 - STRENGTH);
                cogl_color_out = c;
            }
        `;
    }

    static getInversion() {
        return `
            uniform sampler2D tex;
            uniform int INVERSION_MODE;
            // Modes: 0 = Lightness
            //        1 = Lightness - white bias
            //        2 = Color

            // based on shift_whitish.glsl https://github.com/vn971/linux-color-inversion

            void main() {
                vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);
                if (INVERSION_MODE < 2) {
                    /* INVERSION_MODE ? shifted : non-shifted */
                    float white_bias = INVERSION_MODE * c.a * .02;
                    float m = 1.0 + white_bias;
                    float shift = white_bias + c.a - min(c.r, min(c.g, c.b)) - max(c.r, max(c.g, c.b));
                    c = vec4(  ((shift + c.r) / m),
                               ((shift + c.g) / m),
                               ((shift + c.b) / m),
                               c.a);

                } else if (INVERSION_MODE == 2) {
                    c = vec4(c.a * 1 - c.r, c.a * 1 - c.g, c.a * 1 - c.b, c.a);
                }

                // gamma has to be compensated to maintain perceived differences in lightness on dark and light ends of the lightness scale
                float gamma = 1.8;
                c.rgb = pow(c.rgb, vec3(1.0/gamma));

                cogl_color_out = c;
            }
        `;
    }
}
