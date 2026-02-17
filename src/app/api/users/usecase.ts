import { HttpError } from "../lib/errorHandler";
import { UserRepository, CreateUserRequest } from "../repositories/userRepository";

export interface CreateUserUseCase {
  execute(userData: CreateUserRequest): Promise<{ user: any; isNewUser: boolean }>;
}

export const createCreateUserUseCase = ({
  userRepository,
}: {
  userRepository: UserRepository;
}): CreateUserUseCase => {
  const execute = async (userData: CreateUserRequest) => {
    const existingUser = await userRepository.findByEmail(userData.email);
    
    if (existingUser) {
      // User already exists, return the existing user
      return {
        user: existingUser,
        isNewUser: false,
      };
    }

    // User doesn't exist, create new user
    const newUser = await userRepository.create(userData);
    
    return {
      user: newUser,
      isNewUser: true,
    };
  };

  return {
    execute,
  };
};
