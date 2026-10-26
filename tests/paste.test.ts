import {test} from "node:test";
import assert from "node:assert/strict";
import {parsePasted} from "../src/lib/utils";
test("table paste keeps the teacher's date spelling and retains incomplete rows",()=>{
  const rows=parsePasted("1670 - 1671 гг.\tВосстание Разина\nДата неизвестна\tСобытие\n1380\t");
  assert.equal(rows[0].dateText,"1670 - 1671 гг.");
  assert.equal(rows[1].dateText,"Дата неизвестна");
  assert.equal(rows.length,3);
});
