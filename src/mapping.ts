import { near, BigInt, json, JSONValueKind, log } from "@graphprotocol/graph-ts"
import { VerificationRequest } from "../generated/schema"

export function handleReceipt(receiptWithOutcome: near.ReceiptWithOutcome): void {

  const actions = receiptWithOutcome.receipt.actions;
  
  for (let j=0; j < actions.length; j++) {
    handleReceiptAction(
      actions[j], 
      receiptWithOutcome.receipt, 
      receiptWithOutcome.block.header,
      receiptWithOutcome.outcome,
      receiptWithOutcome.receipt.signerPublicKey
    )
  }
}

const LISTEN_TO = 'request_verification'.toString();

function handleReceiptAction(
  action: near.ActionValue,
  receipt: near.ActionReceipt,
  blockHeader: near.BlockHeader,
  outcome: near.ExecutionOutcome,
  publicKey: near.PublicKey
): void {

  // check if its one of the function calls we are listening
  if (action.kind !== near.ActionKind.FUNCTION_CALL) {
    log.info("handleReceiptAction: {}!=={} not a function call", [
      action.kind.toString(), near.ActionKind.FUNCTION_CALL.toString()]);
    return;
  }

  const functionCall = action.toFunctionCall();
  const methodName = functionCall.methodName.toString();
  const isListening = (methodName == LISTEN_TO);
  if (!isListening) {  
    log.info("handleReceiptAction: Listening for: {} is: {}", [
      methodName, isListening.toString()]);
    return;
  }

  log.info("handleReceiptAction: received '{}' function call", [methodName]); 

  // use only the first log line
  let parsed = json.fromString(outcome.logs[0]); 
  if (parsed.kind !== JSONValueKind.OBJECT) {
    log.error("handleReceiptAction: parsed '{}' is not an Object", [outcome.logs[0]]); 
    return;
  }
  
  // create the Entity to be stored in the Subgraph
  // Note: If a handler doesn't require existing field values, it is faster
  // _not_ to load the entity from the store. Instead, create it fresh with
  // `new Entity(...)`, set the fields that should be updated and save the
  // entity back to the store. Fields that were not set or unset remain
  // unchanged, allowing for partial updates to be applied.

  // Entity fields can be set based on receipt information
  // we use the receipt ID as the Entity unique key
  const idn = receipt.id.toHexString();
  let entity = new VerificationRequest(idn);
  
  // Navigate the JSON and copy to the Entity attrs
  // MAZ: no entiendo bien porque se hace asi y no se pude usar la asignacion directa 
  // de props del objeto a la entidad, es porque es AssemblyScript ?
  // afando del ejemplo (https://github.com/open-web-academy/thegraph/blob/main/src/mapping.ts)
  const entry = parsed.toObject();
  for (let i = 0;i < entry.entries.length; i++) {
    let key = entry.entries[i].key.toString()
    switch (true) {
      case key == 'type':
        entity.type = entry.entries[i].value.toString()
        break
      case key == 'requestor_id':
        entity.requestor_id = entry.entries[i].value.toString()
        break
      case key == 'subject_id':
        entity.subject_id = entry.entries[i].value.toString()
        break
      case key == 'state':
        entity.state = entry.entries[i].value.toString()
        break
    }
  }    

  // Entities can be written to the store with `.save()`
  entity.save();

  log.info("handleReceiptAction: saved VerificationRequest '{}'", [idn]); 
}
