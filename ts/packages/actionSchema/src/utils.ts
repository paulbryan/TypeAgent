// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
    SchemaType,
    ActionSchemaTypeDefinition,
    ResolvedSchemaType,
} from "./type.js";

export function resolveReference(
    type?: SchemaType,
): ResolvedSchemaType | undefined {
    if (type === undefined) {
        return undefined;
    }
    let curr = type;
    while (curr.type === "type-reference") {
        if (curr.definition === undefined) {
            return undefined;
        }
        curr = curr.definition.type;
    }
    return curr;
}

// Unresolved type references are ignored.
// Type Union is not supported.
export function getParameterType(
    actionType: ActionSchemaTypeDefinition,
    name: string,
) {
    const propertyNames = name.split(".");
    if (propertyNames.shift() !== "parameters") {
        return undefined;
    }
    let curr = resolveReference(actionType.type.fields.parameters?.type);
    if (curr === undefined) {
        return undefined;
    }
    for (const propertyName of propertyNames) {
        const maybeIndex = parseInt(propertyName);
        let next: SchemaType | undefined;
        if (maybeIndex.toString() == propertyName) {
            if (curr.type !== "array") {
                return undefined;
            }
            next = curr.elementType;
        } else {
            if (curr.type !== "object") {
                return undefined;
            }
            next = curr.fields[propertyName]?.type;
        }

        // TODO: doesn't work on union types yet.
        curr = resolveReference(next);
        if (curr === undefined) {
            return undefined;
        }
    }
    return curr;
}

// Unresolved type references are ignored.
// Type Union is not supported.
export function getParameterNames(
    actionType: ActionSchemaTypeDefinition,
    getCurrentValue: (name: string) => any,
) {
    const parameters = actionType.type.fields.parameters?.type;
    if (parameters === undefined) {
        return [];
    }
    const pending: Array<[string, SchemaType]> = [["parameters", parameters]];
    const result: string[] = [];
    while (true) {
        const next = pending.pop();
        if (next === undefined) {
            return result;
        }

        const [name, field] = next;
        switch (field.type) {
            case "type-union":
                // TODO: Implement this case
                break;
            case "type-reference":
                if (field.definition) {
                    pending.push([name, field.definition.type]);
                }
                break;
            case "object":
                for (const [key, value] of Object.entries(field.fields)) {
                    pending.push([`${name}.${key}`, value.type]);
                }
                break;
            case "array":
                const v = getCurrentValue(name);
                const newIndex = Array.isArray(v) ? v.length : 0;
                for (let i = 0; i <= newIndex; i++) {
                    pending.push([`${name}.${i}`, field.elementType]);
                }
                break;
            default:
                result.push(name);
        }
    }
}
