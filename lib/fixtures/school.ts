/** Teacher, sections and students. Roll numbers follow alphabetical order, as in most Indian schools. */

export const TEACHER = { id: "t_anjali", name: "Anjali Verma", subject: "Mathematics" } as const;

export interface SectionFixture {
  id: string;
  grade: number;
  letter: string;
  name: string;
  subject: string;
  academicYear: string;
}

export const SECTIONS: SectionFixture[] = [
  { id: "sec_8a", grade: 8, letter: "A", name: "8A", subject: "Mathematics", academicYear: "2026–27" },
  { id: "sec_8b", grade: 8, letter: "B", name: "8B", subject: "Mathematics", academicYear: "2026–27" },
  { id: "sec_9a", grade: 9, letter: "A", name: "9A", subject: "Mathematics", academicYear: "2026–27" },
];

const NAMES_8A = [
  "Abhinav Srivastava", "Aishwarya Pillai", "Alok Tripathi", "Amaan Siddiqui", "Anika Chopra", "Anirudh Bhatt",
  "Anushka Ghoshal", "Arnav Dutta", "Bhoomi Parekh", "Chaitanya Kulkarni", "Daksh Arora", "Divya Menon",
  "Esha Sinha", "Fatima Sheikh", "Gautam Rao", "Gunjan Mittal", "Hardik Solanki", "Ira Mathur",
  "Jasleen Gill", "Jay Vora", "Karan Sethi", "Keerthana Raman", "Krish Nambiar", "Lavanya Iyer",
  "Madhav Joshi", "Mahima Rawat", "Mihir Shah", "Naina Kapoor", "Naveen Kumar", "Ojas Deshpande",
  "Palak Goyal", "Parth Vyas", "Prisha Hegde", "Raghav Bansal", "Rehan Ali", "Ritika Saini",
  "Rudra Pratap Singh", "Sakshi Bajaj", "Sameer Kazi", "Shaurya Rana", "Simran Kaur", "Soham Ghosh",
  "Swati Mishra", "Tejas Patil", "Trisha Fernandes", "Vedant Kulkarni", "Vivaan Khanna", "Yamini Reddy",
];

const NAMES_8B = [
  "Aarav Sharma", "Aditi Nair", "Aditya Bhosale", "Akash Yadav", "Ananya Reddy", "Arjun Menon",
  "Ayesha Khan", "Bhavya Joshi", "Chirag Patel", "Deepika Rao", "Dev Malhotra", "Diya Banerjee",
  "Farhan Qureshi", "Gaurav Singh", "Harini Subramanian", "Harpreet Kaur", "Imran Shaikh", "Isha Kulkarni",
  "Ishaan Gupta", "Jatin Chauhan", "Kabir Bhatia", "Kavya Pillai", "Lakshmi Narayanan", "Manav Agarwal",
  "Meera Krishnan", "Mohit Saxena", "Nandini Ghosh", "Neha Pandey", "Nikhil Desai", "Om Prakash Tiwari",
  "Pooja Hegde", "Pranav Iyengar", "Priya Das", "Rahul Chatterjee", "Riya Sen", "Rohan Kumar",
  "Saanvi Mehta", "Sahil Ansari", "Samuel D'Souza", "Sanjana Bose", "Shreya Mukherjee", "Siddharth Jain",
  "Sneha Iyer", "Tanmay Kapoor", "Tanvi Shetty", "Uday Rathore", "Vaishnavi Gowda", "Varun Thakur",
  "Vikram Choudhary", "Yash Dubey", "Zara Hussain", "Zoya Mirza",
];

const NAMES_9A = [
  "Aadhya Jain", "Aayush Raj", "Adarsh Nair", "Akshara Rao", "Alisha Thomas", "Amit Mahato",
  "Ankita Behera", "Arya Kulkarni", "Ashwin Sundaram", "Bhargav Reddy", "Chetna Rathi", "Darshan Gowda",
  "Devansh Agrawal", "Ekta Sharma", "Fiza Ahmed", "Gaurika Bhalla", "Hamza Pathan", "Hiral Shah",
  "Ishita Chakraborty", "Jayesh Wagh", "Jhanvi Purohit", "Kartik Nagar", "Khushi Verma", "Kunal Mehra",
  "Lakshya Chandel", "Mansi Dixit", "Mayank Rawat", "Mrinalini Bora", "Nakul Saxena", "Nidhi Upadhyay",
  "Nirmal Joseph", "Pallavi Sood", "Pratik Jadhav", "Radhika Menon", "Rajat Bisht", "Rashmi Hegde",
  "Ronak Shah", "Sachin Yadav", "Sana Mirza", "Shivam Pandey", "Shruti Pillai", "Siddhi Naik",
  "Sonal Tiwari", "Sumit Lal", "Tanisha Dey", "Tarun Negi", "Urvi Mehta", "Vansh Ahuja",
  "Vidya Krishnamurthy", "Vishal Kamble", "Yuvraj Rathod", "Zainab Hussain",
];

const PARENT_FIRST = [
  "Rajesh", "Sunita", "Mahesh", "Kavita", "Anil", "Meena", "Suresh", "Lata", "Ramesh", "Geeta",
  "Vijay", "Rekha", "Sanjay", "Asha", "Prakash", "Usha", "Ashok", "Neelam", "Dinesh", "Shobha",
  "Arvind", "Pushpa", "Manoj", "Savita", "Rakesh", "Anita", "Vinod", "Seema", "Sunil", "Rani",
];
const MUSLIM_PARENT_FIRST = ["Salim", "Nasreen", "Javed", "Rukhsana", "Aslam", "Shabana"];
const MUSLIM_SURNAMES = new Set(["Khan", "Qureshi", "Shaikh", "Ansari", "Hussain", "Mirza", "Siddiqui", "Sheikh", "Ali", "Kazi", "Ahmed", "Pathan"]);
const CHRISTIAN_PARENT_FIRST = ["Joseph", "Mary", "Thomas", "Grace"];
const CHRISTIAN_SURNAMES = new Set(["D'Souza", "Fernandes", "Thomas", "Joseph"]);
const SIKH_PARENT_FIRST = ["Gurpreet", "Manjit", "Harjinder", "Kulwant"];

export interface StudentFixture {
  id: string;
  sectionId: string;
  name: string;
  rollNumber: number;
  parentName: string;
  parentPhone: string;
  shareToken: string;
}

function surnameOf(name: string) {
  const parts = name.split(" ");
  return parts[parts.length - 1];
}

function parentFor(name: string, index: number): string {
  const surname = surnameOf(name);
  if (MUSLIM_SURNAMES.has(surname)) return `${MUSLIM_PARENT_FIRST[index % MUSLIM_PARENT_FIRST.length]} ${surname}`;
  if (CHRISTIAN_SURNAMES.has(surname)) return `${CHRISTIAN_PARENT_FIRST[index % CHRISTIAN_PARENT_FIRST.length]} ${surname}`;
  if (surname === "Kaur" || surname === "Gill") return `${SIKH_PARENT_FIRST[index % SIKH_PARENT_FIRST.length]} ${surname === "Kaur" ? "Singh" : surname}`;
  return `${PARENT_FIRST[index % PARENT_FIRST.length]} ${surname}`;
}

function tokenFor(sectionId: string, roll: number): string {
  // Deterministic, unguessable-looking token for demo data. Real students get crypto tokens.
  let h = 0x811c9dc5;
  const s = `${sectionId}:${roll}:redpen-share`;
  const out: string[] = [];
  for (let round = 0; round < 4; round++) {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i) + round * 31;
      h = Math.imul(h, 16777619) >>> 0;
    }
    out.push(h.toString(36).padStart(7, "0"));
  }
  return out.join("");
}

function build(sectionId: string, prefix: string, names: string[], phoneBase: number): StudentFixture[] {
  return names.map((name, i) => {
    const roll = i + 1;
    return {
      id: `stu_${prefix}_${String(roll).padStart(2, "0")}`,
      sectionId,
      name,
      rollNumber: roll,
      parentName: parentFor(name, i + phoneBase),
      parentPhone: `+91 9${String(phoneBase * 1000003 + roll * 7919).slice(-9).padStart(9, "0")}`,
      shareToken: tokenFor(sectionId, roll),
    };
  });
}

export const STUDENTS: StudentFixture[] = [
  ...build("sec_8a", "8a", NAMES_8A, 11),
  ...build("sec_8b", "8b", NAMES_8B, 23),
  ...build("sec_9a", "9a", NAMES_9A, 37),
];

export function studentsOf(sectionId: string): StudentFixture[] {
  return STUDENTS.filter((s) => s.sectionId === sectionId);
}

export function studentByName(sectionId: string, name: string): StudentFixture {
  const s = STUDENTS.find((st) => st.sectionId === sectionId && st.name === name);
  if (!s) throw new Error(`Fixture student not found: ${name} in ${sectionId}`);
  return s;
}

export const SECTION_SIZES = { sec_8a: NAMES_8A.length, sec_8b: NAMES_8B.length, sec_9a: NAMES_9A.length };
