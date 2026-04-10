"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SNAP_Scale = void 0;
/**
 * 辅助函数：生成 SNAP-IV 专用的 0-3 分选项
 */
const createSNAPOptions = () => [
    { label: "无", score: 0 },
    { label: "有一点点", score: 1 },
    { label: "还算不少", score: 2 },
    { label: "非常多", score: 3 }
];
// 完整 26 题 4D 结构化数据
const SNAP_QUESTIONS = [
    // ─── 维度一：注意力不足 (Inattention) 题 1-9 ───
    {
        id: 1, text: '在学习或做作业时，很难把注意力长时间集中在一件事上',
        clinical_intent: '评估注意力维持能力',
        colloquial: '宝宝平时写作业或者画画的时候，是不是很难长时间专心做一件事？',
        fallback_examples: ['比如写不了几分钟就要起来走动，或者发呆？'],
        options: createSNAPOptions()
    },
    {
        id: 2, text: '在完成任务时，经常因为分心而做不完',
        clinical_intent: '评估抗干扰能力与任务完成度',
        colloquial: '他做事是不是很容易半途而废？',
        fallback_examples: ['比如搭积木搭到一半，被旁边的事情吸引，就不搭了？'],
        options: createSNAPOptions()
    },
    {
        id: 3, text: '看起来好像在听您说话，但其实并没有真的在听',
        clinical_intent: '评估听觉注意力及心不在焉',
        colloquial: '您跟他说话的时候，他是不是经常像没听见，或者“左耳进右耳出”？',
        fallback_examples: ['比如刚嘱咐完他去拿个东西，他转头就忘了您说啥？'],
        options: createSNAPOptions()
    },
    {
        id: 4, text: '经常难以完成家庭作业或布置的任务',
        clinical_intent: '评估任务执行与完成指令能力',
        colloquial: '老师布置的作业或者您让他做的家务，他能自己按时做完吗？',
        fallback_examples: ['是不是经常磨磨蹭蹭，或者干脆不做？'],
        options: createSNAPOptions()
    },
    {
        id: 5, text: '经常在做事情时表现得没有组织性，手忙脚乱',
        clinical_intent: '评估组织计划与统筹能力',
        colloquial: '他做事是不是经常乱糟糟的，没有条理？',
        fallback_examples: ['比如书包总是乱七八糟，写作业时一会儿找橡皮一会儿找铅笔？'],
        options: createSNAPOptions()
    },
    {
        id: 6, text: '经常逃避、不喜欢或不愿意做需要持续用脑的任务',
        clinical_intent: '评估对认知努力的逃避行为',
        colloquial: '他是不是特别反抗那些需要动脑筋的事？',
        fallback_examples: ['比如一让他写算术题或者看书，他就找各种理由推脱，比如要上厕所喝水？'],
        options: createSNAPOptions()
    },
    {
        id: 7, text: '经常丢三落四，比如弄丢铅笔、书本、作业等',
        clinical_intent: '评估物品保管及日常健忘',
        colloquial: '他的铅笔、橡皮或者外套是不是经常弄丢在学校里找不到了？',
        fallback_examples: ['买的新文具是不是没几天就不见了？'],
        options: createSNAPOptions()
    },
    {
        id: 8, text: '经常被外界的小动静所吸引，容易走神',
        clinical_intent: '评估易受外界刺激干扰的程度',
        colloquial: '旁边稍微有一点声音，比如窗外有车开过，他是不是马上就转头去看，忘了自己在干嘛？',
        fallback_examples: ['上课的时候也容易被旁边同学的小动作吸引吗？'],
        options: createSNAPOptions()
    },
    {
        id: 9, text: '在日常生活中经常表现出健忘，比如忘记约定的事情',
        clinical_intent: '评估日常前瞻性记忆',
        colloquial: '您早上嘱咐他的事，比如放学带什么东西回来，他是不是经常忘得一干二净？',
        fallback_examples: ['日常家里规定好的规矩，是不是也总是转头就忘？'],
        options: createSNAPOptions()
    },
    // ─── 维度二：多动/冲动 (Hyperactivity/Impulsivity) 题 10-18 ───
    {
        id: 10, text: '在座位上经常坐不住，手脚扭来扭去或不停摆弄东西',
        clinical_intent: '评估局部的运动性不安',
        colloquial: '他坐在椅子上的时候，是不是总喜欢扭来扭去，手脚闲不住？',
        fallback_examples: ['吃饭或者写作业时也是手里总想抠点什么？'],
        options: createSNAPOptions()
    },
    {
        id: 11, text: '在课堂上或需要安静的场合，经常离开座位跑来跑去',
        clinical_intent: '评估规则意识缺失及冲动性起立',
        colloquial: '上课或者在外面吃饭需要坐在位子上的时候，他会经常自己站起来离开座位到处乱跑吗？',
        fallback_examples: ['是不是感觉管不住自己的腿？'],
        options: createSNAPOptions()
    },
    {
        id: 12, text: '在应该安静的场合，经常过度地跑跳攀爬',
        clinical_intent: '评估场景不适宜的过度活动',
        colloquial: '带他去如图书馆、餐厅这些需要安静的地方，他还是会跑来跑去、爬上爬下吗？',
        fallback_examples: ['有时候怎么拉都拉不住他？'],
        options: createSNAPOptions()
    },
    {
        id: 13, text: '很难安静地玩耍或参与需要安静的活动',
        clinical_intent: '评估休闲活动中的多动表现',
        colloquial: '他平时在家里玩积木或者看书，能安安静静地待一会儿吗？',
        fallback_examples: ['还是玩任何东西都会弄出很大动静，甚至大喊大叫？'],
        options: createSNAPOptions()
    },
    {
        id: 14, text: '总是动个不停，就像装了马达一样',
        clinical_intent: '评估整体的持续性多动水平',
        colloquial: '您感觉他是不是一天到晚精力旺盛，就像装了小马达一样停不下来？',
        fallback_examples: ['有时候是不是连到了晚上该睡觉的时候，还在兴奋地动？'],
        options: createSNAPOptions()
    },
    {
        id: 15, text: '经常话太多，说个不停',
        clinical_intent: '评估言语多动',
        colloquial: '他平时是不是话特别多，小嘴吧啦吧啦说个不停？',
        fallback_examples: ['有时候即使别人不理他，他也能一个人说很久，显得有点吵？'],
        options: createSNAPOptions()
    },
    {
        id: 16, text: '经常在别人问题还没说完时就抢答',
        clinical_intent: '评估言语冲动性与延迟反应困难',
        colloquial: '别人问他问题，或者大人的话还没说完，他是不是就急着抢答或者插嘴？',
        fallback_examples: ['甚至有时候问题没听完，答非所问就开始说？'],
        options: createSNAPOptions()
    },
    {
        id: 17, text: '在轮流做游戏或活动时，很难耐心等待',
        clinical_intent: '评估延迟满足能力与规则遵守',
        colloquial: '跟别的小朋友一起玩滑梯或者排队的时候，他能耐心排队等吗？',
        fallback_examples: ['是不是总想插队，轮不到自己就急眼？'],
        options: createSNAPOptions()
    },
    {
        id: 18, text: '经常打断别人的谈话或活动',
        clinical_intent: '评估社交冲动与边界感缺失',
        colloquial: '大人正在聊天，或者别的小朋友正在玩，他是不是经常突然插嘴或者冲进去打断？',
        fallback_examples: ['显得有些唐突，不懂得等别人说完？'],
        options: createSNAPOptions()
    },
    // ─── 维度三：对立违抗 (Oppositional Defiant) 题 19-26 ───
    {
        id: 19, text: '经常因为一点小事就发脾气',
        clinical_intent: '评估情绪反应易激惹',
        colloquial: '他是不是经常因为一点点不顺心的小事就大发脾气？',
        fallback_examples: ['比如没按他的意思放东西，或者不给他买零食，就撒泼打滚？'],
        options: createSNAPOptions()
    },
    {
        id: 20, text: '经常和大人争吵',
        clinical_intent: '评估权威挑战与对抗性',
        colloquial: '您或者老师批评他、管教他的时候，他是不是经常顶嘴、跟大人吵架？',
        fallback_examples: ['一点都不服软，非要争个高下？'],
        options: createSNAPOptions()
    },
    {
        id: 21, text: '经常主动拒绝或反抗大人的要求',
        clinical_intent: '评估对指令的主动违抗',
        colloquial: '您让他去做一件很简单的事（比如洗手吃饭），他是不是经常故意不听，甚至直接拒绝您？',
        fallback_examples: ['就是偏偏要跟大人对着干？'],
        options: createSNAPOptions()
    },
    {
        id: 22, text: '经常故意做一些让别人不高兴的事情',
        clinical_intent: '评估挑衅与滋事行为',
        colloquial: '他会不会故意去做一些明知道惹您或者同学不高兴的事？',
        fallback_examples: ['比如故意去推倒别人搭好的积木，看别人生气？'],
        options: createSNAPOptions()
    },
    {
        id: 23, text: '经常因为自己的错误而责怪别人',
        clinical_intent: '评估推卸责任与外归因倾向',
        colloquial: '明明是他自己做错了事（比如打碎了东西），他是不是经常赖在别人头上，或者怪别人没放好？',
        fallback_examples: ['总是找各种借口，就是不肯认错？'],
        options: createSNAPOptions()
    },
    {
        id: 24, text: '经常对别人特别敏感，很容易被激怒',
        clinical_intent: '评估人际过度敏感',
        colloquial: '别的小朋友不小心碰到他，或者开个小玩笑，他是不是很容易就急眼或者发火？',
        fallback_examples: ['就像个小炸药包一样，点火就着？'],
        options: createSNAPOptions()
    },
    {
        id: 25, text: '经常生气或充满敌意',
        clinical_intent: '评估负面情绪基调',
        colloquial: '您感觉他平时是不是经常气鼓鼓的，看谁都不顺眼，带着点敌意？',
        fallback_examples: ['总是觉得周围的同学或者老师在针对他？'],
        options: createSNAPOptions()
    },
    {
        id: 26, text: '经常心怀怨恨或想要报复',
        clinical_intent: '评估报复心理',
        colloquial: '如果有小朋友得罪了他，他是不是记仇记很久，甚至总想着找机会报复回来？',
        fallback_examples: ['经常狠狠地说“我要打他”之类的话？'],
        options: createSNAPOptions()
    }
];
exports.SNAP_Scale = {
    source: "builtin",
    id: "SNAP-IV",
    version: "1.0", // ✅ 新增版本号
    title: {
        zh: "注意缺陷多动障碍筛查量表 (SNAP-IV-26)",
        en: "SNAP-IV ADHD Rating Scale"
    },
    description: {
        zh: "用于评估儿童及青少年注意力缺陷、多动/冲动以及对立违抗行为的严重程度。分为三个独立维度计分。",
        en: "A scale for assessing attention deficit, hyperactivity/impulsivity, and oppositional symptoms."
    },
    category: "Child Development",
    tags: ["儿童发育", "ADHD", "多动", "注意力"],
    interactionMode: "voice_guided",
    supportedLanguages: ["zh", "en"],
    requiresConfirmation: true,
    questions: SNAP_QUESTIONS,
    calculateScore: (answers) => {
        // 确保答案长度正确，避免截取错误
        const safeAnswers = answers.length === 26 ? answers : [...answers, ...Array(26 - answers.length).fill(0)];
        // 核心逻辑：精准切割三个维度的子分数
        const inattentionScore = safeAnswers.slice(0, 9).reduce((sum, s) => sum + s, 0); // 注意力不足 (题1-9)
        const hyperactivityScore = safeAnswers.slice(9, 18).reduce((sum, s) => sum + s, 0); // 多动/冲动 (题10-18)
        const oddScore = safeAnswers.slice(18, 26).reduce((sum, s) => sum + s, 0); // 对立违抗 (题19-26)
        const totalScore = inattentionScore + hyperactivityScore + oddScore;
        let conclusion;
        let detailsStr = `【注意力得分】: ${inattentionScore}/27 (≥13分提示异常)\n【多动冲动得分】: ${hyperactivityScore}/27 (≥13分提示异常)\n【对立违抗得分】: ${oddScore}/24 (≥8分提示异常)\n\n`;
        // 临床标准：任意一个维度的子分数达标，即具有临床意义
        if (inattentionScore >= 13 || hyperactivityScore >= 13 || oddScore >= 8) {
            conclusion = "疑似存在明显 ADHD 症状";
            detailsStr += "临床建议：发现存在核心维度的显著偏高，强烈建议寻求儿童精神科或发育行为科专业医师进行全面评估与干预。";
        }
        else if (totalScore >= 20) {
            // 若子分未达标，但总分较高，提示临界状态
            conclusion = "临界/轻微症状";
            detailsStr += "临床建议：存在部分注意力不集中、多动或违抗表现，建议结合儿童日常表现持续观察，尝试调整教养方式，必要时咨询专业人士。";
        }
        else {
            conclusion = "正常范围";
            detailsStr += "临床建议：目前评估结果在正常范围内，未见明显的注意力缺陷、多动或对立违抗核心症状。";
        }
        return {
            totalScore,
            conclusion,
            details: {
                dimensions: {
                    inattention: inattentionScore,
                    hyperactivity: hyperactivityScore,
                    oppositionalDefiant: oddScore
                },
                description: detailsStr
            }
        };
    }
};
