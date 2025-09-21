import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { PushNotifications } from '@capacitor/push-notifications';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { MessageSquare, Bell, Check, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PermissionStatus {
  sms: 'granted' | 'denied' | 'unknown';
  notifications: 'granted' | 'denied' | 'unknown';
}

export const PermissionManager: React.FC = () => {
  const [permissions, setPermissions] = useState<PermissionStatus>({
    sms: 'unknown',
    notifications: 'unknown'
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      // 푸시 알림 권한 확인
      const notificationStatus = await PushNotifications.checkPermissions();
      
      setPermissions(prev => ({
        ...prev,
        notifications: notificationStatus.receive === 'granted' ? 'granted' : 'denied'
      }));

      // SMS 권한은 Android에서만 확인 가능
      if (Capacitor.getPlatform() === 'android') {
        // SMS 권한 상태는 직접 확인하기 어려우므로 unknown으로 설정
        setPermissions(prev => ({
          ...prev,
          sms: 'unknown'
        }));
      }
    } catch (error) {
      console.error('권한 확인 실패:', error);
    }
  };

  const requestSMSPermission = async () => {
    if (!Capacitor.isNativePlatform()) {
      toast.error('모바일 환경에서만 사용 가능합니다.');
      return;
    }

    if (Capacitor.getPlatform() !== 'android') {
      toast.error('문자 권한은 Android에서만 지원됩니다.');
      return;
    }

    setIsLoading(true);
    console.log('SMS 권한 요청 시작...');
    
    try {
      // Android 권한 직접 요청 방법들을 시도
      if ((window as any).cordova && (window as any).cordova.plugins && (window as any).cordova.plugins.permissions) {
        console.log('Cordova permissions 플러그인 사용');
        const permissions = (window as any).cordova.plugins.permissions;
        const permission = permissions.READ_SMS;
        
        await new Promise<void>((resolve, reject) => {
          permissions.requestPermission(
            permission,
            (status: any) => {
              console.log('SMS 권한 요청 결과:', status);
              if (status.hasPermission) {
                setPermissions(prev => ({ ...prev, sms: 'granted' }));
                toast.success('문자 읽기 권한이 허용되었습니다.');
                resolve();
              } else {
                setPermissions(prev => ({ ...prev, sms: 'denied' }));
                toast.error('문자 읽기 권한이 거부되었습니다.');
                reject(new Error('권한 거부됨'));
              }
            },
            (error: any) => {
              console.log('SMS 권한 요청 에러:', error);
              setPermissions(prev => ({ ...prev, sms: 'denied' }));
              toast.error('문자 읽기 권한 요청에 실패했습니다.');
              reject(error);
            }
          );
        });
      } else if (window.SMS) {
        console.log('SMS 플러그인으로 권한 테스트');
        // SMS 플러그인을 통한 권한 확인
        await new Promise<void>((resolve, reject) => {
          window.SMS.listSMS(
            { box: 'inbox', maxCount: 1 },
            (messages: any) => {
              console.log('SMS 읽기 성공:', messages);
              setPermissions(prev => ({ ...prev, sms: 'granted' }));
              toast.success('문자 읽기 권한이 허용되었습니다.');
              resolve();
            },
            (error: any) => {
              console.log('SMS 읽기 실패:', error);
              setPermissions(prev => ({ ...prev, sms: 'denied' }));
              toast.error('문자 읽기 권한이 필요합니다. 설정 > 앱 > 권한에서 허용해주세요.');
              reject(error);
            }
          );
        });
      } else {
        console.error('SMS 플러그인을 찾을 수 없습니다.');
        toast.error('SMS 플러그인이 설치되지 않았습니다.');
        setPermissions(prev => ({ ...prev, sms: 'denied' }));
      }
    } catch (error) {
      console.error('SMS 권한 요청 실패:', error);
      setPermissions(prev => ({ ...prev, sms: 'denied' }));
      toast.error('SMS 권한 요청에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const requestNotificationPermission = async () => {
    if (!Capacitor.isNativePlatform()) {
      toast.error('모바일 환경에서만 사용 가능합니다.');
      return;
    }

    setIsLoading(true);
    try {
      const permission = await PushNotifications.requestPermissions();
      
      if (permission.receive === 'granted') {
        setPermissions(prev => ({ ...prev, notifications: 'granted' }));
        toast.success('알림 권한이 허용되었습니다.');
      } else {
        setPermissions(prev => ({ ...prev, notifications: 'denied' }));
        toast.error('알림 권한이 거부되었습니다.');
      }
    } catch (error) {
      console.error('알림 권한 요청 실패:', error);
      toast.error('알림 권한 요청에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const openAppSettings = () => {
    if (Capacitor.isNativePlatform()) {
      // Android의 경우 앱 설정으로 이동
      toast.info('설정 > 앱 > 권한에서 수동으로 권한을 허용해주세요.');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'granted':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'denied':
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'granted':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">허용됨</Badge>;
      case 'denied':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">거부됨</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">확인필요</Badge>;
    }
  };

  if (!Capacitor.isNativePlatform()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>권한 설정</CardTitle>
          <CardDescription>
            권한 설정은 모바일 앱에서만 사용 가능합니다.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            문자 읽기 권한
          </CardTitle>
          <CardDescription>
            은행 문자를 자동으로 읽어 거래내역을 등록합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(permissions.sms)}
              {getStatusBadge(permissions.sms)}
            </div>
            <Button
              onClick={requestSMSPermission}
              disabled={isLoading || permissions.sms === 'granted'}
              variant={permissions.sms === 'granted' ? 'secondary' : 'default'}
            >
              {permissions.sms === 'granted' ? '허용됨' : '권한 요청'}
            </Button>
          </div>
          {permissions.sms === 'denied' && (
            <Button variant="outline" onClick={openAppSettings} className="w-full">
              앱 설정에서 권한 허용하기
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            알림 읽기 권한
          </CardTitle>
          <CardDescription>
            결제 앱의 알림을 읽어 거래내역을 자동으로 등록합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(permissions.notifications)}
              {getStatusBadge(permissions.notifications)}
            </div>
            <Button
              onClick={requestNotificationPermission}
              disabled={isLoading || permissions.notifications === 'granted'}
              variant={permissions.notifications === 'granted' ? 'secondary' : 'default'}
            >
              {permissions.notifications === 'granted' ? '허용됨' : '권한 요청'}
            </Button>
          </div>
          {permissions.notifications === 'denied' && (
            <Button variant="outline" onClick={openAppSettings} className="w-full">
              앱 설정에서 권한 허용하기
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm text-blue-800 font-medium">
                권한 설정 안내
              </p>
              <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                <li>문자 권한: 은행 문자를 읽어 자동으로 거래내역을 등록합니다.</li>
                <li>알림 권한: 결제 앱 알림을 읽어 실시간으로 거래를 추적합니다.</li>
                <li>권한이 거부된 경우, 앱 설정에서 수동으로 허용해주세요.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};