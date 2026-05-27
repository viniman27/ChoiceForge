import { describe, test, expect } from "vitest";
import { i18n } from "../../src/data/sampleProject.ts";
import type { I18nLabels, Language } from "../../src/domain/types.ts";

const REQUIRED_KEYS: Array<keyof I18nLabels> = [
  "inspectorEmpty",
  "sourcePreservedNotice",
  "convert",
  "privateNotes",
  "privateNotesPlaceholder",
  "newOption",
  "sourcePreservedBannerTitle",
  "sourcePreservedBannerHint",
  "convertToVisual",
  "convertingScene",
  "searchResultsTitle",
  "searchNoResults",
  "replaceNoMatches",
  "replaceInScene",
  "replaceInAll",
  "noAssetsYet",
  "assetFile",
  "assetUsageNote",
  "varColType", "varColName", "varColInitial", "varColStats", "varColDesc", "varColUses",
  "varTypeNum", "varTypeStr", "varTypeBool",
  "varStatsOff", "varStatsText", "varStatsPercent", "varStatsPair", "varStatsLowLabel", "varUsesTitle",
  "achHidden", "achDescBefore", "achDescAfter", "achUsesSuffix", "achUsesTitle",
  "miniUp", "miniDown", "miniDup", "miniDel",
  "sceneSynopsis", "sceneWordGoal",
  "sourceFilesLabel", "preservedCount", "generatedCount", "addAsset",
  "canvasDup", "canvasFilterPlaceholder", "canvasTagLabel", "canvasClearTagFilter", "canvasSnap",
  "selectedCount",
  "alignLeftTitle", "alignCenterHTitle", "alignRightTitle",
  "alignTopTitle", "alignMiddleVTitle", "alignBottomTitle",
  "distributeHTitle", "distributeVTitle",
  "markDoneTitle", "markTodoTitle", "tagAllAs", "clearTagsTitle",
  "edropConnectHint", "filterPrev", "filterNext",
  "ipOptionsLabel", "ipFakeChoicePrompt", "ipNoCondition", "ipStatStep",
  "ipTargetScene", "ipEntryLabelOptional",
  "ipVariableName", "ipInitialValue", "ipParameterNames",
  "ipFilename", "ipAlignment", "ipAltText",
  "ipAssignAchievement", "ipRemoveAchievement", "ipAchievementField",
  "ipPageBreakLabel", "ipLabelField", "ipComment", "ipPromptText", "ipTargetVariable",
  "ipNextScene", "ipEndOfSceneList",
  "ipFinishHint", "ipReturnHint", "ipEndingHint",
  "ipNoOutgoing", "ipIncomingConnections", "ipLogicStructure", "ipNoBranches",
  "ipVisualFlow", "ipConnect", "ipBranches",
  "ipOptionCondition", "ipBranchEffects", "ipOptionEffects",
  "ipStatEffects", "ipAddEffect",
  "ipChooseAsset", "ipMissing", "ipSelectPlaceholder", "ipNonePlaceholder",
];

const LANGS: Language[] = ["pt", "en", "es"];

describe("i18n coverage — every required key is present in every language", () => {
  for (const lang of LANGS) {
    test(`${lang}: all I18nLabels keys are non-empty strings`, () => {
      const labels = i18n[lang];
      for (const key of REQUIRED_KEYS) {
        const value = labels[key];
        expect(typeof value, `${lang}.${key} should be a string`).toBe("string");
        expect((value as string).trim().length, `${lang}.${key} should not be empty`).toBeGreaterThan(0);
      }
    });
  }

  test("PT/EN/ES disagree on at least one translatable key (sanity check, languages are actually different)", () => {
    const samples = REQUIRED_KEYS.slice(0, 20);
    let differences = 0;
    for (const key of samples) {
      if (i18n.pt[key] !== i18n.en[key] || i18n.en[key] !== i18n.es[key]) {
        differences += 1;
      }
    }
    expect(differences).toBeGreaterThan(5);
  });

  test("interpolation keys carry the {count} placeholder", () => {
    for (const lang of LANGS) {
      expect(i18n[lang].replaceInScene).toContain("{count}");
      expect(i18n[lang].replaceInAll).toContain("{count}");
    }
  });
});
