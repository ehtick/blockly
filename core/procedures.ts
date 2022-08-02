/**
 * @license
 * Copyright 2012 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Utility functions for handling procedures.
 */

/**
 * Utility functions for handling procedures.
 * @namespace Blockly.Procedures
 */
import * as goog from '../closure/goog/goog.js';
goog.declareModuleId('Blockly.Procedures');

// Unused import preserved for side-effects. Remove if unneeded.
import './events/events_block_change.js';

import type {Block} from './block.js';
import type {BlockSvg} from './block_svg.js';
import {Blocks} from './blocks.js';
import * as common from './common.js';
import type {Abstract} from './events/events_abstract.js';
import type {BubbleOpen} from './events/events_bubble_open.js';
import * as eventUtils from './events/utils.js';
import type {Field} from './field.js';
import {Msg} from './msg.js';
import {Names} from './names.js';
import * as utilsXml from './utils/xml.js';
import * as Variables from './variables.js';
import type {Workspace} from './workspace.js';
import type {WorkspaceSvg} from './workspace_svg.js';
import * as Xml from './xml.js';


/**
 * String for use in the "custom" attribute of a category in toolbox XML.
 * This string indicates that the category should be dynamically populated with
 * procedure blocks.
 * See also Blockly.Variables.CATEGORY_NAME and
 * Blockly.VariablesDynamic.CATEGORY_NAME.
 * @alias Blockly.Procedures.CATEGORY_NAME
 */
export const CATEGORY_NAME = 'PROCEDURE';

/**
 * The default argument for a procedures_mutatorarg block.
 * @alias Blockly.Procedures.DEFAULT_ARG
 */
export const DEFAULT_ARG = 'x';

/**
 * Procedure block type.
 * @alias Blockly.Procedures.ProcedureBlock
 */
export interface ProcedureBlock {
  getProcedureCall: () => string;
  renameProcedure: (p1: string, p2: string) => AnyDuringMigration;
  getProcedureDef: () => AnyDuringMigration[];
}

/**
 * Find all user-created procedure definitions in a workspace.
 * @param root Root workspace.
 * @return Pair of arrays, the first contains procedures without return
 *     variables, the second with. Each procedure is defined by a three-element
 *     list of name, parameter list, and return value boolean.
 * @alias Blockly.Procedures.allProcedures
 */
export function allProcedures(root: Workspace): AnyDuringMigration[][][] {
  const proceduresNoReturn =
      root.getBlocksByType('procedures_defnoreturn', false)
          .map(function(block) {
            return (block as unknown as ProcedureBlock).getProcedureDef();
          });
  const proceduresReturn =
      root.getBlocksByType('procedures_defreturn', false).map(function(block) {
        return (block as unknown as ProcedureBlock).getProcedureDef();
      });
  proceduresNoReturn.sort(procTupleComparator);
  proceduresReturn.sort(procTupleComparator);
  return [proceduresNoReturn, proceduresReturn];
}

/**
 * Comparison function for case-insensitive sorting of the first element of
 * a tuple.
 * @param ta First tuple.
 * @param tb Second tuple.
 * @return -1, 0, or 1 to signify greater than, equality, or less than.
 */
function procTupleComparator(
    ta: AnyDuringMigration[], tb: AnyDuringMigration[]): number {
  return ta[0].localeCompare(tb[0], undefined, {sensitivity: 'base'});
}

/**
 * Ensure two identically-named procedures don't exist.
 * Take the proposed procedure name, and return a legal name i.e. one that
 * is not empty and doesn't collide with other procedures.
 * @param name Proposed procedure name.
 * @param block Block to disambiguate.
 * @return Non-colliding name.
 * @alias Blockly.Procedures.findLegalName
 */
export function findLegalName(name: string, block: Block): string {
  if (block.isInFlyout) {
    // Flyouts can have multiple procedures called 'do something'.
    return name;
  }
  name = name || Msg['UNNAMED_KEY'] || 'unnamed';
  while (!isLegalName(name, block.workspace, block)) {
    // Collision with another procedure.
    const r = name.match(/^(.*?)(\d+)$/);
    if (!r) {
      name += '2';
    } else {
      name = r[1] + (parseInt(r[2], 10) + 1);
    }
  }
  return name;
}
/**
 * Does this procedure have a legal name?  Illegal names include names of
 * procedures already defined.
 * @param name The questionable name.
 * @param workspace The workspace to scan for collisions.
 * @param opt_exclude Optional block to exclude from comparisons (one doesn't
 *     want to collide with oneself).
 * @return True if the name is legal.
 */
function isLegalName(
    name: string, workspace: Workspace, opt_exclude?: Block): boolean {
  return !isNameUsed(name, workspace, opt_exclude);
}

/**
 * Return if the given name is already a procedure name.
 * @param name The questionable name.
 * @param workspace The workspace to scan for collisions.
 * @param opt_exclude Optional block to exclude from comparisons (one doesn't
 *     want to collide with oneself).
 * @return True if the name is used, otherwise return false.
 * @alias Blockly.Procedures.isNameUsed
 */
export function isNameUsed(
    name: string, workspace: Workspace, opt_exclude?: Block): boolean {
  const blocks = workspace.getAllBlocks(false);
  // Iterate through every block and check the name.
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i] === opt_exclude) {
      continue;
    }
    // Assume it is a procedure block so we can check.
    const procedureBlock = blocks[i] as unknown as ProcedureBlock;
    if (procedureBlock.getProcedureDef) {
      const procName = procedureBlock.getProcedureDef();
      if (Names.equals(procName[0], name)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Rename a procedure.  Called by the editable field.
 * @param name The proposed new name.
 * @return The accepted name.
 * @alias Blockly.Procedures.rename
 */
export function rename(this: Field, name: string): string {
  // Strip leading and trailing whitespace.  Beyond this, all names are legal.
  name = name.trim();

  const legalName = findLegalName(name, (this.getSourceBlock()));
  const oldName = this.getValue();
  if (oldName !== name && oldName !== legalName) {
    // Rename any callers.
    const blocks = this.getSourceBlock().workspace.getAllBlocks(false);
    for (let i = 0; i < blocks.length; i++) {
      // Assume it is a procedure so we can check.
      const procedureBlock = blocks[i] as unknown as ProcedureBlock;
      if (procedureBlock.renameProcedure) {
        procedureBlock.renameProcedure(oldName as string, legalName);
      }
    }
  }
  return legalName;
}

/**
 * Construct the blocks required by the flyout for the procedure category.
 * @param workspace The workspace containing procedures.
 * @return Array of XML block elements.
 * @alias Blockly.Procedures.flyoutCategory
 */
export function flyoutCategory(workspace: WorkspaceSvg): Element[] {
  const xmlList = [];
  if (Blocks['procedures_defnoreturn']) {
    // <block type="procedures_defnoreturn" gap="16">
    //     <field name="NAME">do something</field>
    // </block>
    const block = utilsXml.createElement('block');
    block.setAttribute('type', 'procedures_defnoreturn');
    // AnyDuringMigration because:  Argument of type 'number' is not assignable
    // to parameter of type 'string'.
    block.setAttribute('gap', 16 as AnyDuringMigration);
    const nameField = utilsXml.createElement('field');
    nameField.setAttribute('name', 'NAME');
    nameField.appendChild(
        utilsXml.createTextNode(Msg['PROCEDURES_DEFNORETURN_PROCEDURE']));
    block.appendChild(nameField);
    xmlList.push(block);
  }
  if (Blocks['procedures_defreturn']) {
    // <block type="procedures_defreturn" gap="16">
    //     <field name="NAME">do something</field>
    // </block>
    const block = utilsXml.createElement('block');
    block.setAttribute('type', 'procedures_defreturn');
    // AnyDuringMigration because:  Argument of type 'number' is not assignable
    // to parameter of type 'string'.
    block.setAttribute('gap', 16 as AnyDuringMigration);
    const nameField = utilsXml.createElement('field');
    nameField.setAttribute('name', 'NAME');
    nameField.appendChild(
        utilsXml.createTextNode(Msg['PROCEDURES_DEFRETURN_PROCEDURE']));
    block.appendChild(nameField);
    xmlList.push(block);
  }
  if (Blocks['procedures_ifreturn']) {
    // <block type="procedures_ifreturn" gap="16"></block>
    const block = utilsXml.createElement('block');
    block.setAttribute('type', 'procedures_ifreturn');
    // AnyDuringMigration because:  Argument of type 'number' is not assignable
    // to parameter of type 'string'.
    block.setAttribute('gap', 16 as AnyDuringMigration);
    xmlList.push(block);
  }
  if (xmlList.length) {
    // Add slightly larger gap between system blocks and user calls.
    // AnyDuringMigration because:  Argument of type 'number' is not assignable
    // to parameter of type 'string'.
    xmlList[xmlList.length - 1].setAttribute('gap', 24 as AnyDuringMigration);
  }

  /**
   * Add items to xmlList for each listed procedure.
   * @param procedureList A list of procedures, each of which is defined by a
   *     three-element list of name, parameter list, and return value boolean.
   * @param templateName The type of the block to generate.
   */
  function populateProcedures(
      procedureList: AnyDuringMigration[][], templateName: string) {
    for (let i = 0; i < procedureList.length; i++) {
      const name = procedureList[i][0];
      const args = procedureList[i][1];
      // <block type="procedures_callnoreturn" gap="16">
      //   <mutation name="do something">
      //     <arg name="x"></arg>
      //   </mutation>
      // </block>
      const block = utilsXml.createElement('block');
      block.setAttribute('type', templateName);
      // AnyDuringMigration because:  Argument of type 'number' is not
      // assignable to parameter of type 'string'.
      block.setAttribute('gap', 16 as AnyDuringMigration);
      const mutation = utilsXml.createElement('mutation');
      mutation.setAttribute('name', name);
      block.appendChild(mutation);
      for (let j = 0; j < args.length; j++) {
        const arg = utilsXml.createElement('arg');
        arg.setAttribute('name', args[j]);
        mutation.appendChild(arg);
      }
      xmlList.push(block);
    }
  }

  // AnyDuringMigration because:  Argument of type 'WorkspaceSvg' is not
  // assignable to parameter of type 'Workspace'.
  const tuple = allProcedures(workspace as AnyDuringMigration);
  populateProcedures(tuple[0], 'procedures_callnoreturn');
  populateProcedures(tuple[1], 'procedures_callreturn');
  return xmlList;
}

/**
 * Updates the procedure mutator's flyout so that the arg block is not a
 * duplicate of another arg.
 * @param workspace The procedure mutator's workspace. This workspace's flyout
 *     is what is being updated.
 */
function updateMutatorFlyout(workspace: WorkspaceSvg) {
  const usedNames = [];
  const blocks = workspace.getBlocksByType('procedures_mutatorarg', false);
  for (let i = 0, block; block = blocks[i]; i++) {
    usedNames.push(block.getFieldValue('NAME'));
  }

  const xmlElement = utilsXml.createElement('xml');
  const argBlock = utilsXml.createElement('block');
  argBlock.setAttribute('type', 'procedures_mutatorarg');
  const nameField = utilsXml.createElement('field');
  nameField.setAttribute('name', 'NAME');
  const argValue =
      Variables.generateUniqueNameFromOptions(DEFAULT_ARG, usedNames);
  const fieldContent = utilsXml.createTextNode(argValue);

  nameField.appendChild(fieldContent);
  argBlock.appendChild(nameField);
  xmlElement.appendChild(argBlock);

  workspace.updateToolbox(xmlElement);
}

/**
 * Listens for when a procedure mutator is opened. Then it triggers a flyout
 * update and adds a mutator change listener to the mutator workspace.
 * @param e The event that triggered this listener.
 * @alias Blockly.Procedures.mutatorOpenListener
 * @internal
 */
export function mutatorOpenListener(e: Abstract) {
  if (e.type !== eventUtils.BUBBLE_OPEN) {
    return;
  }
  const bubbleEvent = e as BubbleOpen;
  if (!(bubbleEvent.bubbleType === 'mutator' && bubbleEvent.isOpen) ||
      !bubbleEvent.blockId) {
    return;
  }
  const workspaceId = (bubbleEvent.workspaceId);
  const block = common.getWorkspaceById(workspaceId)!.getBlockById(
                    bubbleEvent.blockId) as BlockSvg;
  const type = block.type;
  if (type !== 'procedures_defnoreturn' && type !== 'procedures_defreturn') {
    return;
  }
  const workspace = block.mutator!.getWorkspace() as WorkspaceSvg;
  updateMutatorFlyout(workspace);
  workspace.addChangeListener(mutatorChangeListener);
}
/**
 * Listens for changes in a procedure mutator and triggers flyout updates when
 * necessary.
 * @param e The event that triggered this listener.
 */
function mutatorChangeListener(e: Abstract) {
  if (e.type !== eventUtils.BLOCK_CREATE &&
      e.type !== eventUtils.BLOCK_DELETE &&
      e.type !== eventUtils.BLOCK_CHANGE) {
    return;
  }
  const workspaceId = e.workspaceId as string;
  const workspace = common.getWorkspaceById(workspaceId) as WorkspaceSvg;
  updateMutatorFlyout(workspace);
}

/**
 * Find all the callers of a named procedure.
 * @param name Name of procedure.
 * @param workspace The workspace to find callers in.
 * @return Array of caller blocks.
 * @alias Blockly.Procedures.getCallers
 */
export function getCallers(name: string, workspace: Workspace): Block[] {
  const callers = [];
  const blocks = workspace.getAllBlocks(false);
  // Iterate through every block and check the name.
  for (let i = 0; i < blocks.length; i++) {
    // Assume it is a procedure block so we can check.
    const procedureBlock = blocks[i] as unknown as ProcedureBlock;
    if (procedureBlock.getProcedureCall) {
      const procName = procedureBlock.getProcedureCall();
      // Procedure name may be null if the block is only half-built.
      if (procName && Names.equals(procName, name)) {
        callers.push(blocks[i]);
      }
    }
  }
  return callers;
}

/**
 * When a procedure definition changes its parameters, find and edit all its
 * callers.
 * @param defBlock Procedure definition block.
 * @alias Blockly.Procedures.mutateCallers
 */
export function mutateCallers(defBlock: Block) {
  const oldRecordUndo = eventUtils.getRecordUndo();
  const procedureBlock = defBlock as unknown as ProcedureBlock;
  const name = procedureBlock.getProcedureDef()[0];
  const xmlElement = defBlock.mutationToDom!(true);
  const callers = getCallers(name, defBlock.workspace);
  for (let i = 0, caller; caller = callers[i]; i++) {
    const oldMutationDom = caller.mutationToDom!();
    const oldMutation = oldMutationDom && Xml.domToText(oldMutationDom);
    if (caller.domToMutation) {
      caller.domToMutation(xmlElement);
    }
    const newMutationDom = caller.mutationToDom!();
    const newMutation = newMutationDom && Xml.domToText(newMutationDom);
    if (oldMutation !== newMutation) {
      // Fire a mutation on every caller block.  But don't record this as an
      // undo action since it is deterministically tied to the procedure's
      // definition mutation.
      eventUtils.setRecordUndo(false);
      eventUtils.fire(new (eventUtils.get(eventUtils.BLOCK_CHANGE))!
                      (caller, 'mutation', null, oldMutation, newMutation));
      eventUtils.setRecordUndo(oldRecordUndo);
    }
  }
}

/**
 * Find the definition block for the named procedure.
 * @param name Name of procedure.
 * @param workspace The workspace to search.
 * @return The procedure definition block, or null not found.
 * @alias Blockly.Procedures.getDefinition
 */
export function getDefinition(name: string, workspace: Workspace): Block|null {
  // Do not assume procedure is a top block. Some languages allow nested
  // procedures. Also do not assume it is one of the built-in blocks. Only
  // rely on getProcedureDef.
  const blocks = workspace.getAllBlocks(false);
  for (let i = 0; i < blocks.length; i++) {
    // Assume it is a procedure block so we can check.
    const procedureBlock = blocks[i] as unknown as ProcedureBlock;
    if (procedureBlock.getProcedureDef) {
      const tuple = procedureBlock.getProcedureDef();
      if (tuple && Names.equals(tuple[0], name)) {
        return blocks[i];  // Can't use procedureBlock var due to type check.
      }
    }
  }
  return null;
}
