/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview An object that owns a block's rendering SVG elements.
 */

'use strict';

/**
 * An object that owns a block's rendering SVG elements.
 * @class
 */
goog.module('Blockly.blockRendering.PathObject');

/* eslint-disable-next-line no-unused-vars */
const Connection = goog.requireType('Blockly.Connection');
/* eslint-disable-next-line no-unused-vars */
const ConstantProvider = goog.requireType('Blockly.blockRendering.ConstantProvider');
/* eslint-disable-next-line no-unused-vars */
const IPathObject = goog.require('Blockly.blockRendering.IPathObject');
const Svg = goog.require('Blockly.utils.Svg');
/* eslint-disable-next-line no-unused-vars */
const Theme = goog.requireType('Blockly.Theme');
const dom = goog.require('Blockly.utils.dom');
/* eslint-disable-next-line no-unused-vars */
const {Block} = goog.requireType('Blockly.Block');


/**
 * An object that handles creating and setting each of the SVG elements
 * used by the renderer.
 * @param {!SVGElement} root The root SVG element.
 * @param {!Theme.BlockStyle} style The style object to use for
 *     colouring.
 * @param {!ConstantProvider} constants The renderer's
 *     constants.
 * @constructor
 * @implements {IPathObject}
 * @package
 * @alias Blockly.blockRendering.PathObject
 */
const PathObject = function(root, style, constants) {
  /**
   * The renderer's constant provider.
   * @type {!ConstantProvider}
   * @package
   */
  this.constants = constants;

  this.svgRoot = root;

  /**
   * The primary path of the block.
   * @type {!SVGElement}
   * @package
   */
  this.svgPath =
      dom.createSvgElement(Svg.PATH, {'class': 'blocklyPath'}, this.svgRoot);

  /**
   * The style object to use when colouring block paths.
   * @type {!Theme.BlockStyle}
   * @package
   */
  this.style = style;

  /**
   * Holds the cursors svg element when the cursor is attached to the block.
   * This is null if there is no cursor on the block.
   * @type {SVGElement}
   * @package
   */
  this.cursorSvg = null;

  /**
   * Holds the markers svg element when the marker is attached to the block.
   * This is null if there is no marker on the block.
   * @type {SVGElement}
   * @package
   */
  this.markerSvg = null;
};

/**
 * Set the path generated by the renderer onto the respective SVG element.
 * @param {string} pathString The path.
 * @package
 */
PathObject.prototype.setPath = function(pathString) {
  this.svgPath.setAttribute('d', pathString);
};

/**
 * Flip the SVG paths in RTL.
 * @package
 */
PathObject.prototype.flipRTL = function() {
  // Mirror the block's path.
  this.svgPath.setAttribute('transform', 'scale(-1 1)');
};

/**
 * Add the cursor SVG to this block's SVG group.
 * @param {SVGElement} cursorSvg The SVG root of the cursor to be added to the
 *     block SVG group.
 * @package
 */
PathObject.prototype.setCursorSvg = function(cursorSvg) {
  if (!cursorSvg) {
    this.cursorSvg = null;
    return;
  }

  this.svgRoot.appendChild(cursorSvg);
  this.cursorSvg = cursorSvg;
};

/**
 * Add the marker SVG to this block's SVG group.
 * @param {SVGElement} markerSvg The SVG root of the marker to be added to the
 *     block SVG group.
 * @package
 */
PathObject.prototype.setMarkerSvg = function(markerSvg) {
  if (!markerSvg) {
    this.markerSvg = null;
    return;
  }

  if (this.cursorSvg) {
    this.svgRoot.insertBefore(markerSvg, this.cursorSvg);
  } else {
    this.svgRoot.appendChild(markerSvg);
  }
  this.markerSvg = markerSvg;
};

/**
 * Apply the stored colours to the block's path, taking into account whether
 * the paths belong to a shadow block.
 * @param {!Block} block The source block.
 * @package
 */
PathObject.prototype.applyColour = function(block) {
  this.svgPath.setAttribute('stroke', this.style.colourTertiary);
  this.svgPath.setAttribute('fill', this.style.colourPrimary);

  this.updateShadow_(block.isShadow());
  this.updateDisabled_(!block.isEnabled() || block.getInheritedDisabled());
};

/**
 * Set the style.
 * @param {!Theme.BlockStyle} blockStyle The block style to use.
 * @package
 */
PathObject.prototype.setStyle = function(blockStyle) {
  this.style = blockStyle;
};

/**
 * Add or remove the given CSS class on the path object's root SVG element.
 * @param {string} className The name of the class to add or remove
 * @param {boolean} add True if the class should be added.  False if it should
 *     be removed.
 * @protected
 */
PathObject.prototype.setClass_ = function(className, add) {
  if (add) {
    dom.addClass(/** @type {!Element} */ (this.svgRoot), className);
  } else {
    dom.removeClass(/** @type {!Element} */ (this.svgRoot), className);
  }
};

/**
 * Set whether the block shows a highlight or not.  Block highlighting is
 * often used to visually mark blocks currently being executed.
 * @param {boolean} enable True if highlighted.
 * @package
 */
PathObject.prototype.updateHighlighted = function(enable) {
  if (enable) {
    this.svgPath.setAttribute(
        'filter', 'url(#' + this.constants.embossFilterId + ')');
  } else {
    this.svgPath.setAttribute('filter', 'none');
  }
};

/**
 * Updates the look of the block to reflect a shadow state.
 * @param {boolean} shadow True if the block is a shadow block.
 * @protected
 */
PathObject.prototype.updateShadow_ = function(shadow) {
  if (shadow) {
    this.svgPath.setAttribute('stroke', 'none');
    this.svgPath.setAttribute('fill', this.style.colourSecondary);
  }
};

/**
 * Updates the look of the block to reflect a disabled state.
 * @param {boolean} disabled True if disabled.
 * @protected
 */
PathObject.prototype.updateDisabled_ = function(disabled) {
  this.setClass_('blocklyDisabled', disabled);
  if (disabled) {
    this.svgPath.setAttribute(
        'fill', 'url(#' + this.constants.disabledPatternId + ')');
  }
};

/**
 * Add or remove styling showing that a block is selected.
 * @param {boolean} enable True if selection is enabled, false otherwise.
 * @package
 */
PathObject.prototype.updateSelected = function(enable) {
  this.setClass_('blocklySelected', enable);
};

/**
 * Add or remove styling showing that a block is dragged over a delete area.
 * @param {boolean} enable True if the block is being dragged over a delete
 *     area, false otherwise.
 * @package
 */
PathObject.prototype.updateDraggingDelete = function(enable) {
  this.setClass_('blocklyDraggingDelete', enable);
};

/**
 * Add or remove styling showing that a block is an insertion marker.
 * @param {boolean} enable True if the block is an insertion marker, false
 *     otherwise.
 * @package
 */
PathObject.prototype.updateInsertionMarker = function(enable) {
  this.setClass_('blocklyInsertionMarker', enable);
};

/**
 * Add or remove styling showing that a block is movable.
 * @param {boolean} enable True if the block is movable, false otherwise.
 * @package
 */
PathObject.prototype.updateMovable = function(enable) {
  this.setClass_('blocklyDraggable', enable);
};

/**
 * Add or remove styling that shows that if the dragging block is dropped, this
 * block will be replaced.  If a shadow block, it will disappear.  Otherwise it
 * will bump.
 * @param {boolean} enable True if styling should be added.
 * @package
 */
PathObject.prototype.updateReplacementFade = function(enable) {
  this.setClass_('blocklyReplaceable', enable);
};

/**
 * Add or remove styling that shows that if the dragging block is dropped, this
 * block will be connected to the input.
 * @param {Connection} _conn The connection on the input to highlight.
 * @param {boolean} _enable True if styling should be added.
 * @package
 */
PathObject.prototype.updateShapeForInputHighlight = function(_conn, _enable) {
  // NOP
};

exports = PathObject;
