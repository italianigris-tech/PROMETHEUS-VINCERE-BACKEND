import type {
  ReferenceTypographyGrammar,
  ReferenceTypographyObservation,
} from "./reference-typography-policy.js";
import {REFERENCE_TYPOGRAPHY_GRAMMARS} from "./reference-typography-policy.js";

type CorpusSeed = {
  filename: string;
  sha256: string;
  grammarId: keyof typeof REFERENCE_TYPOGRAPHY_GRAMMARS;
  annotation?: ReferenceTypographyObservation["annotation"];
};

const observation = ({
  filename,
  sha256,
  grammarId,
  annotation,
}: CorpusSeed): ReferenceTypographyObservation => {
  const grammar: ReferenceTypographyGrammar = REFERENCE_TYPOGRAPHY_GRAMMARS[grammarId];
  return {
    filename,
    sha256,
    grammarId,
    foundationRole: grammar.foundationRole,
    accentRole: grammar.accentRole,
    caseMode: grammar.caseMode,
    placementPattern: grammar.placementPattern,
    traits: grammar.traits,
    ...(annotation ? {annotation} : {}),
  };
};

export const REFERENCE_TYPOGRAPHY_CORPUS: readonly ReferenceTypographyObservation[] = [
  observation({filename: "image (66).png", sha256: "adf80faee20ead5bdc95fc47b541adaf59ba851d48f36603fbaef8b2c2e319f6", grammarId: "script_over_foundation"}),
  observation({filename: "image (67).png", sha256: "1ad9639384d15e9658806c0480a197eb1899dbfa177dcff18c3cd4840bbcf4b7", grammarId: "quiet_luxury"}),
  observation({filename: "image (68).png", sha256: "df802752cf92714f282ffa050e46f0877569d6e146015b188245de56551b5dd0", grammarId: "inline_italic_hinge"}),
  observation({filename: "image (69).png", sha256: "a8152470c710d9faf43f83257abef6dfc8a16f9c8937dcdfbef7f98e40465a70", grammarId: "annotated_keyword", annotation: "circle"}),
  observation({filename: "image (1).png", sha256: "0f8ec610b46c534d24f141cf76c975cdd969efa9f4be386530bfd54597e52753", grammarId: "stacked_support_hero"}),
  observation({filename: "image (10).png", sha256: "81c8b8c6faad4d96a06caf89e20e86686e7b1978b7b11fa8eb91eaf9da039e97", grammarId: "stacked_support_hero"}),
  observation({filename: "image (11).png", sha256: "571b43ef5586264e994af7828182a9624b29926c8776780cf9a6f2e7a92f116e", grammarId: "stacked_support_hero"}),
  observation({filename: "image (12).png", sha256: "f62528fb7a774b986bd242c302b749a7db509ac09886c43b9820c9eeb3179b6a", grammarId: "stacked_support_hero"}),
  observation({filename: "image (13).png", sha256: "0d0590f5a159b158099f4f52a69ad427fa4a3138a67e3af07ab245efcc5b46c7", grammarId: "script_over_foundation"}),
  observation({filename: "image (14).png", sha256: "756254fd3746277a43fe600b3a5782a1b897f86b0ec9c809f018094722a56621", grammarId: "script_over_foundation"}),
  observation({filename: "image (15).png", sha256: "e93fb448774f5a03a72c37d581c4984607626ffd9ea9e139bb0a6f9d1e3e5922", grammarId: "script_over_foundation"}),
  observation({filename: "image (16).png", sha256: "6a290e252698d4c63327cce574b2ea09372bf1ebcee14b8cbed44138d3f01638", grammarId: "poster_stack", annotation: "highlight"}),
  observation({filename: "image (17).png", sha256: "ca9e9d19e699a2ddece39337e9991319756706aa47154e98ead6c9cf4298c1b9", grammarId: "inline_italic_hinge"}),
  observation({filename: "image (18).png", sha256: "2181c394eb76b17b78c6a10712cfae9481f5a2da3eeb95d35a3c90e6b100381b", grammarId: "quiet_luxury"}),
  observation({filename: "image (19).png", sha256: "6b860643a88f2d8d6a3e206445ba6f012add1bf54d3144cb0b5239cf6aea4004", grammarId: "annotated_keyword", annotation: "circle"}),
  observation({filename: "image (2).png", sha256: "53e59c291d1e60a8e155f37f57b96f1d1a850832b8cc2f1e70943afd50cadf41", grammarId: "quiet_luxury"}),
  observation({filename: "image (20).png", sha256: "4b72894e1dd9bef17b0444777fb84c17855fbcbeb6255ccb17ad4abbab9a11ae", grammarId: "stacked_support_hero"}),
  observation({filename: "image (21).png", sha256: "f3e0a130dc01d2ae2c38459119e2dd0ca4949c860a44c4afc7041184edb59ab6", grammarId: "stacked_support_hero"}),
  observation({filename: "image (22).png", sha256: "f7946755f28ab23d20d0354c79ba6a74337cd20625fffc304d4cd39b53aa3f17", grammarId: "inline_italic_hinge"}),
  observation({filename: "image (23).png", sha256: "0f5fb099cb136cfa3f3bc3208ee162c3b41f35d45ce3b72e79e34b65628d86f7", grammarId: "stacked_support_hero"}),
  observation({filename: "image (24).png", sha256: "a35533c053a1b0ea99d5b9bb47519c6a6b5114e2fea5a0400881371e7a40ed39", grammarId: "script_over_foundation"}),
  observation({filename: "image (25).png", sha256: "5c8f687f4e69c60402398b40147a48cb1c185a8ac20107a5ff51bede9067d3b4", grammarId: "annotated_keyword", annotation: "underline"}),
  observation({filename: "image (26).png", sha256: "d333ba654851016869e5eff4bfa3ee5e094309ad71158a1de816cb9e5e6d0772", grammarId: "poster_stack", annotation: "underline"}),
  observation({filename: "image (27).png", sha256: "8166cc35e516a12791256b3eb52c96747b6c6f86e6dfb3677ac9e173a1818316", grammarId: "inline_mixed_word_splice"}),
  observation({filename: "image (28).png", sha256: "c228e29014d1f98340234e402ce6d66a7b6eafe7c7382c20a7c01f2798d531c7", grammarId: "poster_stack"}),
  observation({filename: "image (29).png", sha256: "5a126fa952349d1fbe46ea3f7d51ef2a0f24fa76a33605749e053e7f6799169a", grammarId: "annotated_keyword", annotation: "circle"}),
  observation({filename: "image (3).png", sha256: "f80f547a58c397f3e76f57c506297e7c81272f1f52dce62ebd6e0efd86e68763", grammarId: "script_over_foundation"}),
  observation({filename: "image (30).png", sha256: "bee9a816f530838e6318c65ad255ec1b3348621b45d5a8502986df2563d20856", grammarId: "annotated_keyword", annotation: "underline"}),
  observation({filename: "image (31).png", sha256: "400a73950bb702430f7e6706929f5f3e12e4dcc7c07c8b67964663ef86115ba1", grammarId: "annotated_keyword", annotation: "circle"}),
  observation({filename: "image (32).png", sha256: "9d8f95b831745fa892382ebd35c56fd3039e5d68dbe218eab29272f11d3385c2", grammarId: "quiet_luxury"}),
  observation({filename: "image (33).png", sha256: "56f0b8529efbb8b68268e3c50d3d94350abcc2ddd07c174e79e243e4b225fadb", grammarId: "quiet_luxury"}),
  observation({filename: "image (34).png", sha256: "eb2039ee2887dfc0b253762b79720deee91236db963733ed146dd2d2dc890610", grammarId: "stacked_support_hero"}),
  observation({filename: "image (35).png", sha256: "7de4c9a3ce9f1a0c8064b2a33c48626d2fdfa466cf1274b58e524432c117c37d", grammarId: "stacked_support_hero"}),
  observation({filename: "image (36).png", sha256: "e19c4d7b34fbe0e8b36121b038100af04dddf507a23d386f53e360a78d0bb7ff", grammarId: "inline_italic_hinge"}),
  observation({filename: "image (37).png", sha256: "1be166386a3f7dbae5fe19158c2939e547665ac6c31e8895fd95374aefef0546", grammarId: "stacked_support_hero"}),
  observation({filename: "image (38).png", sha256: "5812483a3d455e72541734101b5278eddfbd4232331719ee06cc0ae89ba67cba", grammarId: "script_over_foundation"}),
  observation({filename: "image (39).png", sha256: "a9566bcf16e27098bf27ca602bf2b1cef88a48ed4cd097486b3edda7eba72bbe", grammarId: "stacked_support_hero"}),
  observation({filename: "image (4).png", sha256: "62c7d3cc83302d75cfcccadb74ea1001067c5ad2f9c5dda61968cda396341c89", grammarId: "script_over_foundation"}),
  observation({filename: "image (40).png", sha256: "921dcfec302ce61a3be27ba4d7f0f628ec800726c76e2f5ca87f88918a9a57f1", grammarId: "stacked_support_hero"}),
  observation({filename: "image (5).png", sha256: "37fb3fd477d3d65731efc93be00345e924e48c60e7143f1dd0df5161631f48af", grammarId: "annotated_keyword", annotation: "underline"}),
  observation({filename: "image (6).png", sha256: "f364c031a2883dbfd9c2bef410ee8ba2a08324e95cd7f65039ac465239fc9b1f", grammarId: "quiet_luxury"}),
  observation({filename: "image (7).png", sha256: "6c3ea6892701933b743bb4acace555c4db65c12c0e42858a7bd9c181753f3072", grammarId: "script_over_foundation"}),
  observation({filename: "image (8).png", sha256: "e8a0138097dca89395e45f1028d2b127c216c334348a839f6bb2cca76c59e6cd", grammarId: "script_over_foundation"}),
  observation({filename: "image (9).png", sha256: "053580af20088f101ebdee053b0900f348dd5f469cb011826b6746a040d99fe1", grammarId: "script_over_foundation"}),
  observation({filename: "image.png", sha256: "72e8dad141070be9b226320aa0fbbbacec7fc9c636e92fabceb9a3e77f035f27", grammarId: "quiet_luxury"}),
];
