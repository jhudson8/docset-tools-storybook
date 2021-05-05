const WHITESPACE_CHAR_CODES = [32, 9, 10, 11, 12, 13];
const SINGLE_QUOTE_CHAR_CODE = 39;
const DOUBLE_QUOTE_CHAR_CODE = 34;
const LEFT_BRACKET_CHAR_CODE = 123;
const RIGHT_BRACKET_CHAR_CODE = 125;
const QUOTE_CHAR_CODES = [SINGLE_QUOTE_CHAR_CODE, DOUBLE_QUOTE_CHAR_CODE];
const SLASH_CHAR_CODE = 92;

export interface StoryDetails {
    name: string;
    adds: string[];
}

export default function parseStoryModule (content: string): StoryDetails[] {
    const rtn: StoryDetails[] = [];
    let story;
    let nextStoryOfIndex = findNextStoryOfIndex(content);
    while (nextStoryOfIndex) {
        const storyInfo = getFuncNameAndEndEndIndex(nextStoryOfIndex.nameStart, content);
        if (!storyInfo) {
            throw new Error('Invalid story name');
        }
        story = {
            name: storyInfo.name,
            adds: []
        };
        rtn.push(story);
        const nameStart = nextStoryOfIndex.nameStart;
        content = content.substring(nameStart);
        nextStoryOfIndex = findNextStoryOfIndex(content);
        const _content = content.substring(story.name.length + 2, nextStoryOfIndex ? nextStoryOfIndex.start : undefined);
        story.adds = getAdds(_content);
    }
    return rtn;
}

function getAdds (content: string): string[] {
    let startIndex = 0;
    const rtn: string[] = [];
    while (startIndex !== undefined) {
        const bktInfo = findFirstBracketOrAdd(startIndex, content.length, content);
        if (!bktInfo) {
            return rtn;
        } else if (bktInfo.type === 'bracket') {
            // find matching end bracket
            const index = findEndBracketIndex(bktInfo.index, content);
            if (index === undefined) {
                throw new Error('missing end bracket');
            }
            startIndex = index;
        } else {
            // add type
            const index = bktInfo.index;
            const nameAndEndIndex = getFuncNameAndEndEndIndex(index, content);
            if (!nameAndEndIndex || !nameAndEndIndex.name) {
                throw new Error('missing name');
            }
            rtn.push(nameAndEndIndex.name);
            startIndex = nameAndEndIndex.endIndex + 1;
        }
    }
    return rtn;
}

function findEndBracketIndex (startIndex: number, content: string) {
    let bracketStack = 0;
    let quoteType;
    let escaping = false;

    for (let i = startIndex; i < content.length; i++) {
        const code = content.charCodeAt(i)
        if (escaping) {
            escaping = false;
        } else if (!quoteType) {
            // we're not in a string
            if (code === LEFT_BRACKET_CHAR_CODE) {
                bracketStack++;
            } else if (code === RIGHT_BRACKET_CHAR_CODE) {
                bracketStack--;
                if (bracketStack === 0) {
                    return i + 1;
                }
            }
        } else if (code === SLASH_CHAR_CODE) {
            escaping = true;
        } else if (code === quoteType) {
            quoteType = undefined;
        }
    }
}

function findFirstBracketOrAdd (startIndex: number, endIndex: number, content: string) {
    content = content.substring(startIndex, endIndex);
    let addMatch = content.match(/(\.add\s*\()/);
    let nextBracketMatch = content.match(/\{/);
    if (addMatch && nextBracketMatch) {
        if (addMatch.index < nextBracketMatch.index) {
            nextBracketMatch = undefined;
        } else {
            addMatch = undefined;
        }
    }

    if (!nextBracketMatch && !addMatch) {
        return undefined;
    } else if (!addMatch) {
        return {
            type: 'bracket',
            index: nextBracketMatch.index + startIndex
        };
    } else if (!nextBracketMatch) {
        return {
            type: 'add',
            index: addMatch.index + addMatch[1].length + startIndex
        };
    }
}

function getFuncNameAndEndEndIndex (startIndex: number, content: string) {
    let quoteType;
    let escaping;
    let name = ''
    for (let i = startIndex; i < content.length; i++) {
        const code = content.charCodeAt(i)
        const char = content.charAt(i);
        if (escaping) {
            escaping = false;
            if (quoteType) {
                name = name + char;
            } else {
                throw new Error('Invalid escape sequence');
            }
        } else if (!quoteType && isWhitespaceCharCode(code)) {
                // nothing we need to do
                continue;
        } else if (!quoteType) {
            if (QUOTE_CHAR_CODES.includes(code)) {
                quoteType = code;
            } else {
                throw new Error('Invalid quote char: ' + char + ' -- ' + code);
            }
        } else if (code === SLASH_CHAR_CODE) {
            escaping = true;
        } else if (code === quoteType) {
            // we're done
            return {
                name,
                endIndex: startIndex + name.length + 2
            };
        } else {
            name = name + char;
        }
    }
}

function findNextStoryOfIndex (content: string) {
    const match = content.match(/(storiesOf\s*\()/);
    if (match) {
        return {
            start: match.index,
            nameStart: match.index + match[1].length 
        };
    }
}

function isWhitespaceCharCode (code: number) {
    return WHITESPACE_CHAR_CODES.includes(code);
}