/*
 * IMPORTANT NOTE ABOUT PROFILE IMAGES:
 *
 * Clerk's backend API has limitations when setting profile images directly.
 * The recommended approaches are:
 *
 * 1. Store image URLs in publicMetadata during seeding
 * 2. Handle profile image updates on the frontend using Clerk's client-side methods
 * 3. Use Clerk webhooks to process profile images after user creation
 *
 * Frontend example (React):
 * ```javascript
 * import { useUser } from "@clerk/nextjs";
 *
 * const { user } = useUser();
 * const profileImageUrl = user?.publicMetadata?.profileImageUrl;
 *
 * // Update profile image
 * await user.setProfileImage({ file: imageFile });
 * ```
 *
 * Webhook example:
 * Set up a webhook that triggers on user.created events to process
 * the profileImageUrl stored in publicMetadata
 */

import { PrismaClient } from "@prisma/client";
import { createClerkClient, User } from "@clerk/backend";
import { config } from "dotenv";
config();

const prisma = new PrismaClient();
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Type definitions for our seed data
type SeedGrade = {
  level: number;
};

type SeedFeeType = {
  name: string;
  description: string;
  defaultAmount: number;
};

type SeedAdmin = {
  id: string;
  username: string;
};

type SeedTeacher = {
  username: string;
  name: string;
  surname: string;
  email: string;
  phone: string;
  address: string;
  bloodType: string;
  sex: "MALE" | "FEMALE";
  birthday: Date;
  subjectNames: string[];
  img: string;
};

type SeedParent = {
  username: string;
  name: string;
  surname: string;
  email: string;
  phone: string;
  address: string;
};

type SeedStudent = {
  username: string;
  name: string;
  surname: string;
  email: string;
  phone: string;
  address: string;
  img: string;
  bloodType: string;
  sex: "MALE" | "FEMALE";
  birthday: Date;
  className: string;
  parentUsername: string;
  rollNo: number;
};

// Helper function to validate image URLs
function isValidImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      (urlObj.protocol === "http:" || urlObj.protocol === "https:") &&
      url.trim() !== ""
    );
  } catch {
    return false;
  }
}

// Helper function to test image accessibility
async function testImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    const contentType = response.headers.get("content-type");
    return response.ok && (contentType?.startsWith("image/") || false);
  } catch {
    return false;
  }
}

// Helper functions with error handling
async function safeDeleteUser(username: string): Promise<void> {
  try {
    const existingUsers = await clerk.users.getUserList({
      username: [username],
    });
    if (existingUsers.data.length > 0) {
      await clerk.users.deleteUser(existingUsers.data[0].id);
      console.log(`Deleted existing user: ${username}`);
    }
  } catch (error) {
    console.error(
      `Error deleting user ${username}:`,
      error instanceof Error ? error.message : error
    );
  }
}

// Simplified and working createClerkUser function
async function createClerkUser(userData: {
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  emailAddress?: string[];
  publicMetadata?: Record<string, unknown>;
  profileImageUrl?: string;
}): Promise<User> {
  try {
    await safeDeleteUser(userData.username);

    // Prepare public metadata including profile image URL
    const publicMetadata = {
      ...userData.publicMetadata,
      ...(userData.profileImageUrl &&
        isValidImageUrl(userData.profileImageUrl) && {
          profileImageUrl: userData.profileImageUrl,
          hasProfileImage: true,
        }),
    };

    // Create user with metadata (this always works)
    const user = await clerk.users.createUser({
      username: userData.username,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      emailAddress: userData.emailAddress,
      publicMetadata,
    });

    console.log(
      `User created: ${userData.username}${
        userData.profileImageUrl ? " (with profile image URL in metadata)" : ""
      }`
    );
    return user;
  } catch (error) {
    throw new Error(
      `Failed to create Clerk user ${userData.username}: ${
        error instanceof Error ? error.message : error
      }`
    );
  }
}

// Helper function to update profile image after user creation (call this from frontend)
async function updateUserProfileImage(
  userId: string,
  imageUrl: string
): Promise<void> {
  try {
    // This would typically be called from your frontend application
    // where you have access to the proper Clerk client-side methods
    console.log(`Profile image update needed for user ${userId}: ${imageUrl}`);

    // Store the instruction in public metadata
    await clerk.users.updateUser(userId, {
      publicMetadata: {
        pendingProfileImageUrl: imageUrl,
        profileImageUpdateNeeded: true,
      },
    });
  } catch (error) {
    console.error(`Failed to prepare profile image update:`, error);
  }
}

async function seedAdmin(): Promise<void> {
  const adminData = {
    username: "anfaskaloor",
    password: "SecureAdmin123!",
    publicMetadata: { role: "admin" },
  };

  try {
    const user = await createClerkUser(adminData);

    await prisma.admin.upsert({
      where: { username: adminData.username },
      update: {},
      create: {
        id: user.id, // Use the Clerk user ID instead of "1"
        username: adminData.username,
      },
    });

    console.log("Admin user created/updated:", user.id);
  } catch (error) {
    console.error(
      "Error in seedAdmin:",
      error instanceof Error ? error.message : error
    );
    throw error;
  }
}

async function seedGrades(grades: SeedGrade[]): Promise<void> {
  try {
    await prisma.$transaction(
      grades.map((grade) =>
        prisma.grade.upsert({
          where: { level: grade.level },
          update: {},
          create: { level: grade.level },
        })
      )
    );
    console.log("Grades seeded successfully");
  } catch (error) {
    console.error(
      "Error seeding grades:",
      error instanceof Error ? error.message : error
    );
    throw error;
  }
}

async function seedFeeTypes(feeTypes: SeedFeeType[]): Promise<void> {
  try {
    await prisma.$transaction(
      feeTypes.map((feeType) =>
        prisma.feeType.upsert({
          where: { name: feeType.name },
          update: {},
          create: feeType,
        })
      )
    );
    console.log("Fee types seeded successfully");
  } catch (error) {
    console.error(
      "Error seeding fee types:",
      error instanceof Error ? error.message : error
    );
    throw error;
  }
}

async function clearAllClerkUsers(): Promise<void> {
  try {
    console.log("Clearing all Clerk users...");
    let hasMore = true;
    let offset = 0;
    const limit = 100; // Clerk's max limit per page

    while (hasMore) {
      const userList = await clerk.users.getUserList({ limit, offset });
      
      // Delete users in parallel
      await Promise.all(
        userList.data.map(user => 
          clerk.users.deleteUser(user.id).catch(e => 
            console.error(`Failed to delete user ${user.id}:`, e instanceof Error ? e.message : e)
          )
        )
      );

      hasMore = userList.data.length === limit;
      offset += limit;
      console.log(`Deleted ${userList.data.length} users...`);
    }

    console.log("All Clerk users cleared successfully");
  } catch (error) {
    console.error(
      "Error clearing Clerk users:",
      error instanceof Error ? error.message : error
    );
    throw error;
  }
}

// Main seed function
async function main() {
  try {
    await clearAllClerkUsers()
    // Basic seed
    await seedAdmin();

    const grades: SeedGrade[] = Array.from({ length: 6 }, (_, i) => ({
      level: i + 1,
    }));
    await seedGrades(grades);

    const feeTypes: SeedFeeType[] = [
      {
        name: "Tuition",
        description: "Monthly tuition fee",
        defaultAmount: 150.0,
      },
      {
        name: "Lab Fee",
        description: "Science lab maintenance fee",
        defaultAmount: 50.0,
      },
      {
        name: "Library Fee",
        description: "Library membership and maintenance",
        defaultAmount: 30.0,
      },
      {
        name: "Transport",
        description: "School bus fee",
        defaultAmount: 75.0,
      },
    ];
    await seedFeeTypes(feeTypes);

    // Uncomment if you want to run the full seed
    await fullSeed();

    console.log("Seed completed successfully");
  } catch (error) {
    console.error(
      "Error in main seed function:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

// Full seed function with all data
async function fullSeed(): Promise<void> {
  try {
    console.log("Starting full seed...");

    // Clear existing data in a safe order (respecting foreign key constraints)
    const modelNames = [
      "result",
      "assignment", 
      "exam",
      "attendance",
      "lesson",
      "fee",
      "incident",
      "behavior",
      "announcementView",
      "announcement",
      "event",
      "student",
      "parent",
      "teacher",
      "subject",
      "class",
    ];

    for (const model of modelNames) {
      try {
        await (prisma as any)[model].deleteMany();
        console.log(`Cleared ${model} table`);
      } catch (error) {
        console.error(
          `Error clearing ${model} table:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    // Create Grades
    const grades = await prisma.$transaction(
      [9, 10, 11].map((level) =>
        prisma.grade.upsert({
          where: { level },
          update: {},
          create: { level },
        })
      )
    );

    // Create Subjects
    const subjectNames = ["Mathematics", "Science", "English", "History"];
    const subjects = await prisma.$transaction(
      subjectNames.map((name) =>
        prisma.subject.upsert({
          where: { name },
          update: {},
          create: { name },
        })
      )
    );

    // Create Teachers with profile images
    const teachersData: SeedTeacher[] = [
      {
        username: "teacher1",
        name: "John",
        surname: "Smith",
        email: "john.smith@school.edu",
        phone: "555-0101",
        address: "123 Teacher St, Education City",
        bloodType: "A+",
        sex: "MALE",
        birthday: new Date("1980-05-15"),
        subjectNames: ["Mathematics", "Science"],
        img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&auto=format&fit=crop&crop=face",
      },
      {
        username: "teacher2",
        name: "Sarah",
        surname: "Johnson",
        email: "sarah.johnson@school.edu",
        phone: "555-0102",
        address: "456 Educator Ave, Education City",
        bloodType: "B+",
        sex: "FEMALE",
        birthday: new Date("1985-08-22"),
        subjectNames: ["English"],
        img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&auto=format&fit=crop&crop=face",
      },
      {
        username: "teacher3",
        name: "Michael",
        surname: "Brown",
        email: "michael.brown@school.edu",
        phone: "555-0103",
        address: "789 Professor Blvd, Education City",
        bloodType: "O+",
        sex: "MALE",
        birthday: new Date("1975-11-30"),
        subjectNames: ["History"],
        img: "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=200&h=200&auto=format&fit=crop&crop=face",
      },
    ];

    const teachers = await Promise.all(
      teachersData.map(async (teacherData) => {
        const clerkUser = await createClerkUser({
          username: teacherData.username,
          password: "SecureAdmin123!",
          firstName: teacherData.name,
          lastName: teacherData.surname,
          emailAddress: [teacherData.email],
          publicMetadata: { role: "teacher" },
          profileImageUrl: teacherData.img,
        });

        const subjectConnections = teacherData.subjectNames.map((name) => {
          const subject = subjects.find((s) => s.name === name);
          if (!subject) throw new Error(`Subject ${name} not found`);
          return { id: subject.id };
        });

        return prisma.teacher.upsert({
          where: { id: clerkUser.id },
          update: {},
          create: {
            id: clerkUser.id,
            username: teacherData.username,
            name: teacherData.name,
            surname: teacherData.surname,
            email: teacherData.email,
            phone: teacherData.phone,
            address: teacherData.address,
            bloodType: teacherData.bloodType,
            sex: teacherData.sex,
            birthday: teacherData.birthday,
            subjects: { connect: subjectConnections },
          },
        });
      })
    );

    // Create Parents
    const parentsData: SeedParent[] = [
      {
        username: "parent1",
        name: "Robert",
        surname: "Williams",
        email: "robert.williams@example.com",
        phone: "555-0201",
        address: "101 Parent Lane, Family Town",
      },
      {
        username: "parent2",
        name: "Jennifer",
        surname: "Davis",
        email: "jennifer.davis@example.com",
        phone: "555-0202",
        address: "202 Guardian Ave, Family Town",
      },
      {
        username: "parent3",
        name: "Thomas",
        surname: "Miller",
        email: "thomas.miller@example.com",
        phone: "555-0203",
        address: "303 Caregiver St, Family Town",
      },
      {
        username: "parent4",
        name: "Lisa",
        surname: "Wilson",
        email: "lisa.wilson@example.com",
        phone: "555-0204",
        address: "404 Family Rd, Family Town",
      },
    ];

    const parents = await Promise.all(
      parentsData.map(async (parentData) => {
        const clerkUser = await createClerkUser({
          username: parentData.username,
          password: "SecureAdmin123!",
          firstName: parentData.name,
          lastName: parentData.surname,
          emailAddress: [parentData.email],
          publicMetadata: { role: "parent" },
        });

        return prisma.parent.upsert({
          where: { id: clerkUser.id },
          update: {},
          create: {
            id: clerkUser.id,
            username: parentData.username,
            name: parentData.name,
            surname: parentData.surname,
            email: parentData.email,
            phone: parentData.phone,
            address: parentData.address,
          },
        });
      })
    );

    // Create Classes
    const classesData = [
      {
        name: "9-A",
        capacity: 30,
        supervisorUsername: "teacher1",
        gradeLevel: 9,
      },
      {
        name: "10-B",
        capacity: 25,
        supervisorUsername: "teacher2",
        gradeLevel: 10,
      },
      {
        name: "11-C",
        capacity: 20,
        supervisorUsername: "teacher3",
        gradeLevel: 11,
      },
    ];

    const classes = await Promise.all(
      classesData.map(async (classData) => {
        const grade = grades.find((g) => g.level === classData.gradeLevel);
        if (!grade) throw new Error(`Grade ${classData.gradeLevel} not found`);

        const teacher = teachers.find(
          (t) => t.username === classData.supervisorUsername
        );
        if (!teacher)
          throw new Error(`Teacher ${classData.supervisorUsername} not found`);

        return prisma.class.upsert({
          where: { name: classData.name },
          update: {},
          create: {
            name: classData.name,
            capacity: classData.capacity,
            supervisorId: teacher.id,
            gradeId: grade.id,
          },
        });
      })
    );

    // Create Students with profile images
    const studentsData: SeedStudent[] = [
      {
        username: "student1",
        name: "Emily",
        surname: "Williams",
        email: "emily.williams@school.edu",
        phone: "555-0301",
        address: "101 Student Lane, Education City",
        img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&auto=format&fit=crop&crop=face",
        bloodType: "A+",
        sex: "FEMALE",
        birthday: new Date("2008-03-10"),
        className: "9-A",
        parentUsername: "parent1",
        rollNo: 1,
      },
      {
        username: "student2",
        name: "James",
        surname: "Davis",
        email: "james.davis@school.edu",
        phone: "555-0302",
        address: "202 Learner Ave, Education City",
        img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&auto=format&fit=crop&crop=face",
        bloodType: "B+",
        sex: "MALE",
        birthday: new Date("2007-07-15"),
        className: "9-A",
        parentUsername: "parent2",
        rollNo: 2,
      },
      {
        username: "student3",
        name: "Sophia",
        surname: "Miller",
        email: "sophia.miller@school.edu",
        phone: "555-0303",
        address: "303 Scholar St, Education City",
        img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&auto=format&fit=crop&crop=face",
        bloodType: "O+",
        sex: "FEMALE",
        birthday: new Date("2006-11-20"),
        className: "10-B",
        parentUsername: "parent3",
        rollNo: 1,
      },
      {
        username: "student4",
        name: "Daniel",
        surname: "Wilson",
        email: "daniel.wilson@school.edu",
        phone: "555-0304",
        address: "404 Scholar Rd, Education City",
        img: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&auto=format&fit=crop&crop=face",
        bloodType: "B-",
        sex: "MALE",
        birthday: new Date("2005-09-05"),
        className: "11-C",
        parentUsername: "parent4",
        rollNo: 1,
      },
      {
        username: "student5",
        name: "Olivia",
        surname: "Williams",
        email: "olivia.williams@school.edu",
        phone: "555-0305",
        address: "505 Student Ave, Education City",
        img: "https://images.unsplash.com/photo-1554151228-14d9def656e4?w=200&h=200&auto=format&fit=crop&crop=face",
        bloodType: "A-",
        sex: "FEMALE",
        birthday: new Date("2008-07-15"),
        className: "9-A",
        parentUsername: "parent1",
        rollNo: 3,
      },
      {
        username: "student6",
        name: "Ethan",
        surname: "Johnson",
        email: "ethan.johnson@school.edu",
        phone: "555-0306",
        address: "606 Learner Blvd, Education City",
        img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&auto=format&fit=crop&crop=face",
        bloodType: "AB+",
        sex: "MALE",
        birthday: new Date("2006-05-22"),
        className: "10-B",
        parentUsername: "parent4",
        rollNo: 2,
      },
    ];

    const students = await Promise.all(
      studentsData.map(async (studentData) => {
        const clerkUser = await createClerkUser({
          username: studentData.username,
          password: "SecureAdmin123!",
          firstName: studentData.name,
          lastName: studentData.surname,
          emailAddress: [studentData.email],
          publicMetadata: { role: "student" },
          profileImageUrl: studentData.img,
        });

        const classRecord = classes.find(
          (c) => c.name === studentData.className
        );
        if (!classRecord)
          throw new Error(`Class ${studentData.className} not found`);

        const grade = grades.find(
          (g) => g.level === parseInt(studentData.className.split("-")[0])
        );
        if (!grade)
          throw new Error(`Grade for class ${studentData.className} not found`);

        const parent = parents.find(
          (p) => p.username === studentData.parentUsername
        );
        if (!parent)
          throw new Error(`Parent ${studentData.parentUsername} not found`);

        return prisma.student.upsert({
          where: { id: clerkUser.id },
          update: {},
          create: {
            id: clerkUser.id,
            username: studentData.username,
            name: studentData.name,
            surname: studentData.surname,
            email: studentData.email,
            phone: studentData.phone,
            address: studentData.address,
            img: studentData.img,
            bloodType: studentData.bloodType,
            sex: studentData.sex,
            birthday: studentData.birthday,
            classId: classRecord.id,
            gradeId: grade.id,
            parentId: parent.id,
            rollNo: studentData.rollNo,
          },
        });
      })
    );

    // Create some basic lessons for demonstration
    const lessons = await Promise.all([
      prisma.lesson.create({
        data: {
          name: "Algebra Basics",
          day: "MONDAY",
          subjectId: subjects.find((s) => s.name === "Mathematics")!.id,
          classId: classes.find((c) => c.name === "9-A")!.id,
          teacherId: teachers.find((t) => t.username === "teacher1")!.id,
        },
      }),
      prisma.lesson.create({
        data: {
          name: "English Literature",
          day: "TUESDAY",
          subjectId: subjects.find((s) => s.name === "English")!.id,
          classId: classes.find((c) => c.name === "10-B")!.id,
          teacherId: teachers.find((t) => t.username === "teacher2")!.id,
        },
      }),
    ]);

    // Create some fees for students with required fields
    const feeType = await prisma.feeType.findFirst({
      where: { name: "Tuition" },
    });

    if (feeType) {
      await Promise.all(
        students.slice(0, 3).map((student) =>
          prisma.fee.create({
            data: {
              amount: feeType.defaultAmount!,
              dueDate: new Date("2024-12-31"),
              status: "pending", // Use lowercase to match schema default
              academicYear: "2024-2025", // Required field
              semester: "Fall", // Required field
              studentId: student.id,
              feeTypeId: feeType.id,
            },
          })
        )
      );
    }

    console.log("Full seed completed successfully");
    console.log(
      `Created ${teachers.length} teachers with profile image URLs in metadata`
    );
    console.log(
      `Created ${students.length} students with profile image URLs in metadata`
    );
    console.log(`Created ${parents.length} parents`);
    console.log(`Created ${classes.length} classes`);

    // Log instructions for frontend implementation
    console.log("\n=== FRONTEND IMPLEMENTATION GUIDE ===");
    console.log("To display profile images in your frontend:");
    console.log("1. Access user.publicMetadata.profileImageUrl");
    console.log("2. Use it as the src for profile images");
    console.log(
      "3. Implement image update functionality using Clerk's client methods"
    );
    console.log("=====================================\n");
  } catch (error) {
    console.error(
      "Error in fullSeed:",
      error instanceof Error ? error.message : error
    );
    throw error;
  }
}

// Execute
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });