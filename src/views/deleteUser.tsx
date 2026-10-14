import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { pizzaService } from '../service/service';
import { User } from '../service/pizzaService';
import View from './view';
import Button from '../components/button';
import { useBreadcrumb } from '../hooks/appNavigation';

export default function DeleteUser() {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('id');
  const navigateToParentPath = useBreadcrumb();
  const [user, setUser] = React.useState<User | null>(null);
  const [errorMessage, setErrorMessage] = React.useState('');

  // Load the user fresh so the page never shows stale details
  React.useEffect(() => {
    (async () => {
      try {
        setUser(await pizzaService.getUserById(userId ?? ''));
      } catch (err: any) {
        setErrorMessage(`Unable to load user: ${err.message}`);
      }
    })();
  }, [userId]);

  async function deleteUser() {
    try {
      await pizzaService.deleteUser(user!);
      navigateToParentPath();
    } catch (err: any) {
      setErrorMessage(`Unable to delete user: ${err.message}`);
    }
  }

  return (
    <View title='Delete user'>
      <div className='text-start py-8 px-4 sm:px-6 lg:px-8'>
        {user && (
          <div className='text-neutral-100'>
            Are you sure you want to delete the user <span className='text-orange-500'>{user.name}</span> ({user.email})? This cannot be undone.
          </div>
        )}
        {errorMessage && (
          <div role='alert' className='my-2 text-yellow-200'>
            {errorMessage}
          </div>
        )}
        {user && <Button title='Delete' onPress={deleteUser} />}
        <Button title='Cancel' onPress={navigateToParentPath} className='bg-transparent border-neutral-300' />
      </div>
    </View>
  );
}
