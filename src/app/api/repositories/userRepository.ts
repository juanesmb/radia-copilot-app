import { SupabaseClient } from "@supabase/supabase-js";

export interface User {
  id: string;
  created_at: string;
  email: string;
  language: string;
}

export interface CreateUserRequest {
  email: string;
  language: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  create(userData: CreateUserRequest): Promise<User>;
}

export const createUserRepository = (supabaseClient: SupabaseClient): UserRepository => {
  const findByEmail = async (email: string): Promise<User | null> => {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw error;
    }

    return data;
  };

  const create = async (userData: CreateUserRequest): Promise<User> => {
    const { data, error } = await supabaseClient
      .from('users')
      .insert({
        email: userData.email,
        language: userData.language,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  };

  return {
    findByEmail,
    create,
  };
};
