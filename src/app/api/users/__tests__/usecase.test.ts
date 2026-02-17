import { describe, expect, it, vi, beforeEach } from "vitest";
import { createCreateUserUseCase } from "../usecase";
import { createUserRepository } from "../../repositories/userRepository";

// Mock the userRepository
const mockUserRepository = {
  findByEmail: vi.fn(),
  create: vi.fn(),
} as any;

describe("CreateUserUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a new user when email doesn't exist", async () => {
    const userData = { email: "test@example.com", language: "es" };
    const newUser = {
      id: "47d07d2c-e4b1-4e31-980d-e25002b5a0cb",
      created_at: "2026-02-17 21:19:25.08899+00",
      email: "test@example.com",
      language: "es",
    };

    mockUserRepository.findByEmail.mockResolvedValue(null);
    mockUserRepository.create.mockResolvedValue(newUser);

    const useCase = createCreateUserUseCase({
      userRepository: mockUserRepository,
    });

    const result = await useCase.execute(userData);

    expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(userData.email);
    expect(mockUserRepository.create).toHaveBeenCalledWith(userData);
    expect(result).toEqual({
      user: newUser,
      isNewUser: true,
    });
  });

  it("should return existing user when email already exists", async () => {
    const userData = { email: "existing@example.com", language: "es" };
    const existingUser = {
      id: "47d07d2c-e4b1-4e31-980d-e25002b5a0cb",
      created_at: "2026-02-17 21:19:25.08899+00",
      email: "existing@example.com",
      language: "es",
    };

    mockUserRepository.findByEmail.mockResolvedValue(existingUser);

    const useCase = createCreateUserUseCase({
      userRepository: mockUserRepository,
    });

    const result = await useCase.execute(userData);

    expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(userData.email);
    expect(mockUserRepository.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      user: existingUser,
      isNewUser: false,
    });
  });
});
