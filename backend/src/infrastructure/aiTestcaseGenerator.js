import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI("AIzaSyAMU2-MATPnenfDs6G_rmQDTDSUakmUZrA");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function generateTestcases({ problemStatement, constraints, normalCount = 3, edgeCount = 2, randomCount = 2 }) {
  console.log('=== AI TESTCASE GENERATION START ===');
  console.log('Counts:', { normalCount, edgeCount, randomCount });
  
  try {
    const prompt = `
You are an expert at generating test cases for coding problems. Based on the problem statement and constraints, generate test case inputs.

Problem Statement: ${problemStatement}

Constraints: ${typeof constraints === 'string' ? constraints : JSON.stringify(constraints, null, 2)}

Generate test cases in the following format:
- Normal cases: ${normalCount} typical inputs that test the main functionality
- Edge cases: ${edgeCount} boundary values and edge cases (minimum/maximum values, empty inputs, etc.)
- Random cases: ${randomCount} random but valid inputs

Return ONLY a JSON object with this exact structure:
{
  "normal": ["input1", "input2", ...],
  "edge": ["input1", "input2", ...],
  "random": ["input1", "input2", ...]
}

Each input should be a single line string that represents the input format described in the problem. Do not include any explanations or additional text.
`;

    console.log('Sending prompt to Gemini...');
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    console.log('Gemini response:', response);

    if (!response) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response
    let testcases;
    try {
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : response.trim();
      testcases = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', response);
      throw new Error('Invalid JSON response from AI');
    }

    // Validate the structure
    if (!testcases.normal || !testcases.edge || !testcases.random) {
      throw new Error('Invalid testcase structure from AI');
    }

    // Ensure we have the right number of testcases
    const finalResult = {
      normal: testcases.normal.slice(0, normalCount),
      edge: testcases.edge.slice(0, edgeCount),
      random: testcases.random.slice(0, randomCount)
    };

    console.log('Generated testcases:', finalResult);
    console.log('=== AI TESTCASE GENERATION SUCCESS ===');
    
    return finalResult;

  } catch (error) {
    console.log('=== AI TESTCASE GENERATION ERROR ===');
    console.error('Error generating testcases:', error);
    
    // Fallback: generate simple testcases if AI fails
    console.log('Using fallback testcase generation...');
    return generateFallbackTestcases({ normalCount, edgeCount, randomCount });
  }
}

function generateFallbackTestcases({ normalCount, edgeCount, randomCount }) {
  // Simple fallback testcases for common problem types
  const fallback = {
    normal: Array.from({ length: normalCount }, (_, i) => `${i + 1} ${i + 2}`),
    edge: Array.from({ length: edgeCount }, (_, i) => i === 0 ? "0 0" : "1 1"),
    random: Array.from({ length: randomCount }, (_, i) => `${Math.floor(Math.random() * 100)} ${Math.floor(Math.random() * 100)}`)
  };
  
  console.log('Fallback testcases:', fallback);
  return fallback;
}
